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

        if (PocketExpensesWidgetProvider.ACTION_ADD_EXPENSE.equals(action) ||
            PocketExpensesWidgetProvider.ACTION_VALUE_ADD.equals(extraAction)) {
            lastPendingAction = PocketExpensesWidgetProvider.ACTION_VALUE_ADD;
            if (activeInstance != null) {
                JSObject ret = new JSObject();
                ret.put("action", PocketExpensesWidgetProvider.ACTION_VALUE_ADD);
                activeInstance.notifyListeners("widgetAction", ret);
            }
        }
    }

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String monthTotal = call.getString("monthTotal", "$0.00");
        String subStat = call.getString("subStat", "Tap to view");
        String lastUpdated = call.getString("lastUpdated", "");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
                PocketExpensesWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
        );
        prefs.edit()
                .putString(PocketExpensesWidgetProvider.KEY_MONTH_TOTAL, monthTotal)
                .putString(PocketExpensesWidgetProvider.KEY_SUB_STAT, subStat)
                .putString(PocketExpensesWidgetProvider.KEY_LAST_UPDATED, lastUpdated)
                .apply();

        PocketExpensesWidgetProvider.updateAllWidgets(context);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
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
