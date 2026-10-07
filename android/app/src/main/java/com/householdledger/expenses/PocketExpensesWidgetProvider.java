package com.householdledger.expenses;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class PocketExpensesWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "pocket_expenses_widget_prefs";
    public static final String KEY_MONTH_TOTAL = "month_total";
    public static final String KEY_SUB_STAT = "sub_stat";
    public static final String KEY_LAST_UPDATED = "last_updated";

    public static final String ACTION_ADD_EXPENSE = "com.householdledger.expenses.ACTION_ADD_EXPENSE";
    public static final String EXTRA_ACTION = "action";
    public static final String ACTION_VALUE_ADD = "add_expense";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String monthTotal = prefs.getString(KEY_MONTH_TOTAL, "$0.00");
        String subStat = prefs.getString(KEY_SUB_STAT, "Tap to view");
        String lastUpdated = prefs.getString(KEY_LAST_UPDATED, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_pocket_expenses);
        views.setTextViewText(R.id.widget_month_total, monthTotal);
        views.setTextViewText(R.id.widget_label, prefs.getString("month_label", "Spent this month"));
        views.setTextViewText(R.id.widget_dining_total, prefs.getString("dining_total", "JOD 0.000"));
        views.setTextViewText(R.id.widget_grocery_total, prefs.getString("grocery_total", "JOD 0.000"));
        views.setTextViewText(R.id.widget_today_total, prefs.getString(QuickActionsWidgetProvider.KEY_TODAY_TOTAL, "JOD 0.000"));

        views.setImageViewResource(R.id.widget_first_icon, categoryIcon(prefs.getString("first_category_icon", "utensils")));
        views.setImageViewResource(R.id.widget_second_icon, categoryIcon(prefs.getString("second_category_icon", "shopping-cart")));
        views.setContentDescription(R.id.widget_first_icon, prefs.getString("first_category_name", "Dining Out"));
        views.setContentDescription(R.id.widget_second_icon, prefs.getString("second_category_name", "Groceries"));

        // 1. Intent for opening the app normally when clicking anywhere on the widget card
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, openAppPendingIntent);

        // 2. Intent for "+ Add" button to open app directly into Add Expense screen
        Intent addExpenseIntent = new Intent(context, MainActivity.class);
        addExpenseIntent.setAction(ACTION_ADD_EXPENSE);
        addExpenseIntent.putExtra(EXTRA_ACTION, ACTION_VALUE_ADD);
        addExpenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent addExpensePendingIntent = PendingIntent.getActivity(
                context,
                1,
                addExpenseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_add, addExpensePendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static int categoryIcon(String icon) {
        if ("utensils".equals(icon)) return R.drawable.widget_dining_icon;
        if ("shopping-cart".equals(icon) || "shopping-bag".equals(icon)) return R.drawable.widget_grocery_icon;
        if ("car".equals(icon)) return R.drawable.widget_transport_icon;
        return R.drawable.widget_category_icon;
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, android.os.Bundle options) {
        updateAppWidget(context, manager, widgetId);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, PocketExpensesWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }
}
