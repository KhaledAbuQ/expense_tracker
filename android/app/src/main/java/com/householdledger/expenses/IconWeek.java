package com.householdledger.expenses;

import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.TimeZone;

final class IconWeek {
    static int index(Calendar local) {
        Calendar day = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
        day.clear(); day.set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH));
        long ordinal = Math.floorDiv(day.getTimeInMillis(), 86400000L);
        return (int)Math.floorMod(Math.floorDiv(ordinal - 4, 7), 2);
    }
    static Calendar nextMonday(Calendar now) {
        Calendar next = (Calendar)now.clone();
        next.set(Calendar.HOUR_OF_DAY,0);next.set(Calendar.MINUTE,0);next.set(Calendar.SECOND,0);next.set(Calendar.MILLISECOND,0);
        int days=(Calendar.MONDAY-next.get(Calendar.DAY_OF_WEEK)+7)%7;
        next.add(Calendar.DAY_OF_MONTH,days==0?7:days);
        return next;
    }
}
