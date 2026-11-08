package com.householdledger.expenses;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.*;
import android.content.pm.PackageManager;
import java.util.Calendar;

/** Launcher aliases alternate each Monday; rechecked at launch, reboot and clock changes. */
public class WeeklyIconReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){ sync(context); }
    static void sync(Context context){
        PackageManager manager=context.getPackageManager();
        ComponentName classic=new ComponentName(context,context.getPackageName()+".LauncherClassic");
        ComponentName celebration=new ComponentName(context,context.getPackageName()+".LauncherCelebration");
        boolean alternate=IconWeek.index(Calendar.getInstance())==1;
        ComponentName target=alternate?celebration:classic,other=alternate?classic:celebration;
        if(!enabled(manager,target,!alternate))manager.setComponentEnabledSetting(target,PackageManager.COMPONENT_ENABLED_STATE_ENABLED,PackageManager.DONT_KILL_APP);
        if(enabled(manager,other,alternate))manager.setComponentEnabledSetting(other,PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP);
        AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if(alarms!=null){
            Intent tick=new Intent(context,WeeklyIconReceiver.class).setAction("com.householdledger.expenses.WEEKLY_ICON");
            PendingIntent pending=PendingIntent.getBroadcast(context,740,tick,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            // Inexact, non-waking alarm. The launcher can refresh after Android exits idle mode.
            alarms.set(AlarmManager.RTC,IconWeek.nextMonday(Calendar.getInstance()).getTimeInMillis(),pending);
        }
    }
    private static boolean enabled(PackageManager manager,ComponentName component,boolean defaultValue){
        int state=manager.getComponentEnabledSetting(component);
        return state==PackageManager.COMPONENT_ENABLED_STATE_ENABLED || (state==PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && defaultValue);
    }
}
