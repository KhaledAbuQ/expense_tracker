package com.householdledger.expenses;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExpenseWidget")
public class ExpenseWidgetPlugin extends Plugin {

    private static String lastPendingAction = null;
    private static ExpenseWidgetPlugin activeInstance = null;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
        // Check initial launch intent
        if (getActivity() != null && getActivity().getIntent() != null) {
            handleIntent(getActivity().getIntent());
        }
    }

    public static void handleNewIntent(Intent intent) {
        handleIntent(intent);
    }

    private static void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String extraAction = intent.getStringExtra(PocketExpensesWidgetProvider.EXTRA_ACTION);

        String requested = PocketExpensesWidgetProvider.ACTION_ADD_EXPENSE.equals(action) ? "add_expense" : extraAction;
        if ("add_expense".equals(requested) || "transfers".equals(requested) || "home".equals(requested) || "income".equals(requested) || "savings".equals(requested) || "savings_goal".equals(requested) || "expenses".equals(requested)) {
            lastPendingAction = requested;
            intent.removeExtra(PocketExpensesWidgetProvider.EXTRA_ACTION);
            intent.setAction(Intent.ACTION_MAIN);
            if (activeInstance != null) {
                JSObject ret = new JSObject();
                ret.put("action", requested);
                activeInstance.notifyListeners("widgetAction", ret);
            }
        }
    }

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String monthTotal = call.getString("monthTotal", "$0.00");
        String todayTotal = call.getString("todayTotal", "$0.00");
        String subStat = call.getString("subStat", "Tap to view");
        String lastUpdated = call.getString("lastUpdated", "");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
                PocketExpensesWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
        );
        prefs.edit()
                .putString("finance_snapshot", call.getString("snapshot", "{}"))
                .putString("first_category_name", call.getString("firstCategoryName", "Dining Out"))
                .putString("second_category_name", call.getString("secondCategoryName", "Groceries"))
                .putString("first_category_icon", call.getString("firstCategoryIcon", "utensils"))
                .putString("second_category_icon", call.getString("secondCategoryIcon", "shopping-cart"))
                .putString("month_label", call.getString("monthLabel", "Spent this month"))
                .putString("dining_total", call.getString("diningTotal", "JOD 0.000"))
                .putString("grocery_total", call.getString("groceryTotal", "JOD 0.000"))
                .putString(PocketExpensesWidgetProvider.KEY_MONTH_TOTAL, monthTotal)
                .putString(QuickActionsWidgetProvider.KEY_TODAY_TOTAL, todayTotal)
                .putString(PocketExpensesWidgetProvider.KEY_SUB_STAT, subStat)
                .putString(PocketExpensesWidgetProvider.KEY_LAST_UPDATED, lastUpdated)
                .apply();

        PocketExpensesWidgetProvider.updateAllWidgets(context);
        QuickActionsWidgetProvider.updateAllWidgets(context);
        FinanceWidgetProvider.updateAllWidgets(context);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateSavingsPlan(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PocketExpensesWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
        try {
            org.json.JSONObject data = new org.json.JSONObject(prefs.getString("finance_snapshot", "{}"));
            Double goal = call.getDouble("goalAmount", 0.0);
            Double current = call.getDouble("currentSavings");
            data.put("savingsGoal", Math.max(0, goal));
            data.put("savingsGoalBalance", current != null ? current : data.optDouble("savingsAmount", 0));
            prefs.edit().putString("finance_snapshot", data.toString()).apply();
            FinanceWidgetProvider.updateAllWidgets(getContext());
            JSObject result = new JSObject(); result.put("success", true); call.resolve(result);
        } catch (org.json.JSONException error) { call.reject("Could not update savings goal", error); }
    }

    @PluginMethod
    public void checkLaunchIntent(PluginCall call) {
        JSObject ret = new JSObject();
        if (lastPendingAction != null) {
            ret.put("action", lastPendingAction);
            lastPendingAction = null; // Clear after reading
        } else if (getActivity() != null && getActivity().getIntent() != null) {
            Intent intent = getActivity().getIntent();
            String action = intent.getAction();
            String extraAction = intent.getStringExtra(PocketExpensesWidgetProvider.EXTRA_ACTION);
            if (PocketExpensesWidgetProvider.ACTION_ADD_EXPENSE.equals(action) ||
                PocketExpensesWidgetProvider.ACTION_VALUE_ADD.equals(extraAction)) {
                ret.put("action", PocketExpensesWidgetProvider.ACTION_VALUE_ADD);
                // Clear the intent action so it won't trigger repeatedly
                intent.removeExtra(PocketExpensesWidgetProvider.EXTRA_ACTION);
                intent.setAction(Intent.ACTION_MAIN);
            } else {
                ret.put("action", null);
            }
        } else {
            ret.put("action", null);
        }
        call.resolve(ret);
    }
}
