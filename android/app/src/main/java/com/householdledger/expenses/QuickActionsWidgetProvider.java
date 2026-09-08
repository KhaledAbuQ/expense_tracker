package com.householdledger.expenses;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class QuickActionsWidgetProvider extends AppWidgetProvider {

    public static final String KEY_TODAY_TOTAL = "today_total";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(
                PocketExpensesWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
        );
        String todayTotal = prefs.getString(KEY_TODAY_TOTAL, "$0.00");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_actions);
        views.setTextViewText(R.id.widget_quick_amount, todayTotal);

        // Open app when tapping the widget container
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context,
                200,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quick_root, openAppPendingIntent);

        // Open Add Expense when tapping "+ Add"
        Intent addExpenseIntent = new Intent(context, MainActivity.class);
        addExpenseIntent.setAction(PocketExpensesWidgetProvider.ACTION_ADD_EXPENSE);
        addExpenseIntent.putExtra(PocketExpensesWidgetProvider.EXTRA_ACTION, PocketExpensesWidgetProvider.ACTION_VALUE_ADD);
        addExpenseIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent addExpensePendingIntent = PendingIntent.getActivity(
                context,
                201,
                addExpenseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quick_btn_add, addExpensePendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, QuickActionsWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }
}
