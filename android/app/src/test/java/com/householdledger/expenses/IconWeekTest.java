package com.householdledger.expenses;
import org.junit.Test;
import static org.junit.Assert.*;
import java.util.*;

public class IconWeekTest {
    private Calendar date(String zone,int day,int hour){Calendar c=Calendar.getInstance(TimeZone.getTimeZone(zone));c.clear();c.set(2026,Calendar.NOVEMBER,day,hour,0);return c;}
    @Test public void changesOnMondayAndStaysForSevenDays(){
        for(String zone:new String[]{"Asia/Amman","America/New_York","UTC"}){
            Calendar sunday=date(zone,8,23),monday=date(zone,9,0);
            assertNotEquals(IconWeek.index(sunday),IconWeek.index(monday));
            for(int day=9;day<=15;day++)assertEquals(IconWeek.index(monday),IconWeek.index(date(zone,day,12)));
            assertEquals(IconWeek.index(sunday),IconWeek.index(date(zone,16,0)));
            Calendar next=IconWeek.nextMonday(sunday);assertEquals(Calendar.MONDAY,next.get(Calendar.DAY_OF_WEEK));assertEquals(9,next.get(Calendar.DAY_OF_MONTH));assertEquals(0,next.get(Calendar.HOUR_OF_DAY));
            assertEquals(16,IconWeek.nextMonday(monday).get(Calendar.DAY_OF_MONTH));
        }
    }
}
