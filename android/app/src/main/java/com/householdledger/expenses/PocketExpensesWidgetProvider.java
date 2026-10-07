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
        FinanceWidgetProvider.update(context, appWidgetManager, appWidgetId, "pocket");
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
