package com.householdledger.expenses;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

public class GoldWidgetProvider extends FinanceWidgetProvider {
    @Override
    protected String kind() {
        return "gold";
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, GoldWidgetProvider.class))) {
            update(context, manager, id, "gold");
        }
    }
}
