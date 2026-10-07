package com.householdledger.expenses;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.*;
import android.graphics.*;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;
import java.util.Locale;

/** Reference-style widgets drawn locally; no placeholder financial data. */
public abstract class FinanceWidgetProvider extends AppWidgetProvider {
    protected abstract String kind();
    private static final String PRIVACY="com.householdledger.expenses.WIDGET_PRIVACY";
    private static final int BLUE=0xff087bfa, INK=0xff111111, GRAY=0xff75757d;
    private static final int[] COLORS={0xff18afe9,0xff754ce5,0xff0cbf90,0xffff8a00,0xffffda36,0xffcecece};
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)update(c,m,id,kind());}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){update(c,m,id,kind());}
    @Override public void onReceive(Context c,Intent i){
        super.onReceive(c,i);
        if(PRIVACY.equals(i.getAction())){
            SharedPreferences p=prefs(c);p.edit().putBoolean("wallet_hidden",!p.getBoolean("wallet_hidden",true)).apply();updateAllWidgets(c);
        }
    }
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PocketExpensesWidgetProvider.PREFS_NAME,Context.MODE_PRIVATE);}
    private static PendingIntent launch(Context c,String action,int code){
        Intent i=new Intent(c,MainActivity.class).setAction(action.equals("add_expense")?PocketExpensesWidgetProvider.ACTION_ADD_EXPENSE:Intent.ACTION_MAIN).putExtra(PocketExpensesWidgetProvider.EXTRA_ACTION,action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void update(Context c,AppWidgetManager m,int id,String kind){
        SharedPreferences p=prefs(c);JSONObject data;
        try{data=new JSONObject(p.getString("finance_snapshot","{}"));}catch(JSONException e){data=new JSONObject();}
        Bundle options=m.getAppWidgetOptions(id);
        int w=Math.max(140,Math.min(600,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,kind.equals("monthreport")||kind.equals("dailycompare")?330:180)));
        int h=Math.max(130,Math.min(600,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,kind.equals("monthreport")?360:180)));
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.widget_reference_card);
        v.setImageViewBitmap(R.id.reference_widget_art,render(kind,data,p,w,h));
        v.setContentDescription(R.id.reference_widget_art,kind+" · "+p.getString("month_label","This month")+" · monthly spending "+p.getString("month_total","JOD 0.000"));
        String action=kind.equals("addexpense")?"add_expense":kind.equals("smartsavings")?"savings":"home";
        v.setOnClickPendingIntent(R.id.reference_widget_root,launch(c,action,610+action.hashCode()));
        if(kind.equals("sendreceive")){
            v.setViewVisibility(R.id.reference_widget_primary,View.VISIBLE);v.setViewVisibility(R.id.reference_widget_secondary,View.VISIBLE);
            v.setOnClickPendingIntent(R.id.reference_widget_primary,launch(c,"transfers",611));
            v.setOnClickPendingIntent(R.id.reference_widget_secondary,launch(c,"income",612));
        }
        if(kind.equals("smartsavings")){
            v.setViewVisibility(R.id.reference_widget_footer,View.VISIBLE);
            Intent goal=new Intent(c,WidgetSavingsGoalActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            v.setOnClickPendingIntent(R.id.reference_widget_footer,PendingIntent.getActivity(c,613,goal,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        }
        if(kind.equals("walletcard")){
            Intent toggle=new Intent(c,WalletCardWidgetProvider.class).setAction(PRIVACY);
            v.setViewVisibility(R.id.reference_widget_footer,View.VISIBLE);v.setContentDescription(R.id.reference_widget_footer,"Show or hide bank balance");
            v.setOnClickPendingIntent(R.id.reference_widget_footer,PendingIntent.getBroadcast(c,614,toggle,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        }
        m.updateAppWidget(id,v);
    }
    private static String amount(double n){return String.format(Locale.US,"%,.3f",n);}
    private static class Art {
        Canvas c;Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);float w,h;
        Art(Canvas c,float w,float h){this.c=c;this.w=w;this.h=h;}
        void text(String s,float x,float y,float size,int color,boolean bold){p.setShader(null);p.setStyle(Paint.Style.FILL);p.setColor(color);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(size);p.setTextAlign(Paint.Align.LEFT);c.drawText(s,x,y,p);}
        void fit(String s,float x,float y,float size,float width,int color,boolean bold){p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));while(p.measureText(s)>width && size>8){size-=.5f;p.setTextSize(size);}text(s,x,y,size,color,bold);}
        void center(String s,float x,float y,float size,int color,boolean bold){p.setTextSize(size);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));text(s,x-p.measureText(s)/2,y,size,color,bold);}
        void round(float x,float y,float width,float height,float radius,int color){p.setShader(null);p.setColor(color);p.setStyle(Paint.Style.FILL);c.drawRoundRect(x,y,x+width,y+height,radius,radius,p);}
        void gradient(float x,float y,float width,float height,float radius,int from,int to){p.setStyle(Paint.Style.FILL);p.setShader(new LinearGradient(x,y,x+width,y+height,from,to,Shader.TileMode.CLAMP));c.drawRoundRect(x,y,x+width,y+height,radius,radius,p);p.setShader(null);}
        void circle(float x,float y,float radius,int color){p.setShader(null);p.setColor(color);p.setStyle(Paint.Style.FILL);c.drawCircle(x,y,radius,p);}
        void line(float x,float y,float xx,float yy,int color,float stroke){p.setShader(null);p.setColor(color);p.setStrokeWidth(stroke);p.setStrokeCap(Paint.Cap.ROUND);c.drawLine(x,y,xx,yy,p);}
        void arc(RectF r,float start,float sweep,int color,float width){p.setShader(null);p.setColor(color);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(width);p.setStrokeCap(Paint.Cap.BUTT);c.drawArc(r,start,sweep,false,p);p.setStyle(Paint.Style.FILL);}
        void arrow(float x,float y,float size,int color,boolean down){float sign=down?-1:1;line(x-size/2,y+sign*size/2,x+size/2,y-sign*size/2,color,3);line(x+size/2,y-sign*size/2,x-size/5,y-sign*size/2,color,3);line(x+size/2,y-sign*size/2,x+size/2,y+sign*size/5,color,3);}
    }
    private static Bitmap render(String kind,JSONObject d,SharedPreferences prefs,int width,int height){
        boolean report=kind.equals("monthreport"), wide=kind.equals("dailycompare");
        float w=report?360:wide?420:220, h=report?400:wide?200:220;
        // Preserve the reference's proportions when launchers supply a different aspect ratio.
        Bitmap b=Bitmap.createBitmap(width*2,height*2,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(b);
        float scale=Math.min(width/w,height/h)*2;canvas.translate((width*2-w*scale)/2,(height*2-h*scale)/2);canvas.scale(scale,scale);
        Path clip=new Path();clip.addRoundRect(new RectF(1,1,w-1,h-1),25,25,Path.Direction.CW);canvas.clipPath(clip);
        Art a=new Art(canvas,w,h);a.gradient(0,0,w,h,25,0xffffffff,0xfff6faff);
        if(kind.equals("addexpense")||kind.equals("sendreceive")||kind.equals("walletcard"))a.gradient(0,0,w,h,25,0xff007eff,0xff104c91);
        double spending=d.optDouble("monthAmount",0), earning=d.optDouble("monthIncome",0), available=d.optDouble("availableAmount",0);
        JSONArray categories=d.optJSONArray("categories");if(categories==null)categories=new JSONArray();
        if(report){
            a.gradient(0,0,w,111,0,0xff007eff,0xff1057ad);
            a.text(d.optString("monthName","THIS MONTH"),18,28,14,Color.WHITE,true);
            String[] labels={"EARNING","SPENDING","BALANCE"};double[] nums={earning,spending,d.optDouble("monthNet",0)};
            for(int i=0;i<3;i++){float x=18+i*116;a.text(labels[i],x,66,10,0xffd3e8ff,false);a.fit(amount(nums[i]),x,91,22,104,Color.WHITE,true);}
            JSONArray cats=topCategories(categories,5);double total=spending;float start=-90;
            for(int i=0;i<cats.length();i++){JSONObject cat=cats.optJSONObject(i);float sweep=total>0?(float)(cat.optDouble("total",0)/total*360):0;a.arc(new RectF(25,151,141,267),start,sweep,COLORS[i%6],24);start+=sweep;}
            if(total<=0)a.arc(new RectF(25,151,141,267),0,360,0xffeeeeee,24);
            for(int i=0;i<cats.length();i++){JSONObject cat=cats.optJSONObject(i);float y=148+i*26;a.circle(169,y-4,4,COLORS[i%6]);a.fit(cat.optString("name","Other"),181,y,12,100,GRAY,false);a.text(String.format(Locale.US,"%.1f%%",total>0?cat.optDouble("total",0)/total*100:0),294,y,11,INK,false);}
            if(cats.length()==0)a.text("No spending yet",165,196,12,GRAY,false);
            JSONArray weeks=d.optJSONArray("weekNet");double max=1;if(weeks!=null)for(int i=0;i<weeks.length();i++)max=Math.max(max,Math.abs(weeks.optJSONObject(i).optDouble("value",0)));
            for(int i=0;i<4;i++){float x=36+i*90;double val=weeks==null?0:weeks.optJSONObject(i).optDouble("value",0);a.center(val==0?"—":amount(val),x,327,16,INK,true);float bar=(float)(Math.abs(val)/max*27);a.round(x-4,354-bar,8,Math.max(2,bar),4,val<0?0xffcecece:BLUE);a.center("Week "+(i+1),x,375,12,GRAY,false);}
            a.text("JOD",18,391,8,GRAY,false);
        }else if(kind.equals("todayspend")){
            a.text("TODAY",20,33,13,GRAY,true);a.text("SPENDING",20,53,13,GRAY,true);a.arrow(189,31,18,0xff3694ff,false);
            JSONArray merchants=d.optJSONArray("todayMerchants");int n=merchants==null?0:Math.min(3,merchants.length());
            for(int i=0;i<n;i++){float x=46+i*39;a.circle(x,100,25,new int[]{0xff151515,0xff00875a,0xff006acb}[i]);String name=merchants.optString(i,"Expense");a.center(name.substring(0,Math.min(2,name.length())).toUpperCase(Locale.US),x,105,13,Color.WHITE,true);}
            if(n==0)a.text("No purchases today",20,102,12,GRAY,false);
            a.text("TOTAL",20,164,12,GRAY,true);a.text("TRANS",143,164,12,GRAY,true);a.fit(amount(d.optDouble("todayAmount",0)),20,198,27,114,INK,true);a.text(String.valueOf(d.optInt("todayCount",0)),143,198,27,INK,true);
        }else if(kind.equals("spending")){
            a.text("SPENDING",20,33,13,GRAY,true);a.round(20,48,180,31,10,0xffeeeeee);float x=20;
            JSONArray cats=topCategories(categories,3);
            for(int i=0;i<cats.length();i++){JSONObject cat=cats.optJSONObject(i);float segment=spending>0?(float)(cat.optDouble("total",0)/spending*180):0;a.round(x,48,Math.max(0,segment-1),31,0,new int[]{BLUE,0xff069c00,0xff754ce5,0xffcecece}[i%4]);x+=segment;}
            for(int i=0;i<cats.length();i++){float cx=26+(i%2)*95,cy=102+(i/2)*24;a.circle(cx,cy-4,4,new int[]{BLUE,0xff069c00,0xff754ce5,0xffcecece}[i%4]);a.fit(cats.optJSONObject(i).optString("name"),cx+9,cy,12,76,GRAY,false);}
            if(cats.length()==0)a.text("No spending yet",20,108,12,GRAY,false);
            a.text("AVAILABLE",20,163,12,GRAY,true);a.fit(amount(available),20,198,27,142,INK,true);
            a.text(earning>0?Math.round(d.optDouble("monthNet",0)/earning*100)+"%":"—",170,196,16,INK,false);
        }else if(kind.equals("addexpense")){
            a.text(d.optString("weekday","Today"),20,36,18,Color.WHITE,false);a.text(d.optString("dateLabel",""),20,59,13,Color.WHITE,false);
            a.p.setShadowLayer(14,0,0,0x887bc0ff);a.circle(110,116,41,0xfffcfcff);a.p.clearShadowLayer();a.line(94,116,126,116,0xff318cff,4);a.line(110,100,110,132,0xff318cff,4);a.center("ADD EXPENSE",110,194,16,Color.WHITE,true);
        }else if(kind.equals("smartsavings")){
            a.text("SMART SAVINGS",20,32,13,GRAY,true);double savings=d.optDouble("savingsAmount",0),goal=prefs.getFloat("savings_goal",0);
            a.arc(new RectF(40,55,180,195),180,180,0xffe8efff,22);float sweep=goal>0?(float)Math.max(0,Math.min(180,savings/goal*180)):0;
            a.arc(new RectF(40,55,180,195),180,Math.min(sweep,90),0xff4047ee,22);if(sweep>90)a.arc(new RectF(40,55,180,195),270,sweep-90,0xff5298ff,22);
            a.center("SAVING",110,113,13,GRAY,false);a.text("0",25,143,11,GRAY,false);a.fit(goal>0?amount(goal):"Set goal",159,143,11,48,GRAY,false);a.text("BALANCE",20,163,12,GRAY,true);a.fit(amount(savings),20,196,28,181,INK,true);a.text("Tap here to set goal",20,212,8,GRAY,false);
        }else if(kind.equals("walletcard")){
            a.gradient(24,22,172,120,16,0xfffafafa,0xffe5e7ee);a.text("BANK",38,48,17,0xff10268c,true);a.text("••••",156,48,14,GRAY,false);
            // Pocket front with the curved card-access notch from the reference.
            Path pocket=new Path();pocket.moveTo(0,83);pocket.lineTo(74,83);pocket.cubicTo(89,83,87,107,110,107);pocket.cubicTo(132,107,132,83,146,83);pocket.lineTo(220,83);pocket.lineTo(220,220);pocket.lineTo(0,220);pocket.close();a.p.setShader(new LinearGradient(0,83,220,220,0xff429dff,0xff0074ee,Shader.TileMode.CLAMP));canvas.drawPath(pocket,a.p);a.p.setShader(null);
            a.text("BALANCE",20,150,14,Color.WHITE,true);boolean hidden=prefs.getBoolean("wallet_hidden",true);a.fit(hidden?"* * * *":amount(d.optDouble("bankAmount",0)),20,194,27,162,Color.WHITE,true);
            a.arc(new RectF(174,154,199,176),0,180,Color.WHITE,2);for(int i=0;i<5;i++){float xx=176+i*5;a.line(xx,174,xx-2,179,Color.WHITE,2);}a.text("Tap bottom to "+(hidden?"show":"hide"),20,211,8,0xffe7f1ff,false);
        }else if(wide){
            JSONArray rows=d.optJSONArray("week");double spent=0,earned=0,max=1;
            if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);spent+=row.optDouble("value",0);earned+=row.optDouble("earned",0);max=Math.max(max,Math.max(row.optDouble("value",0),row.optDouble("earned",0)));}
            a.fit(amount(spent),22,38,26,170,INK,true);a.fit(amount(earned),272,38,26,126,INK,true);a.line(24,52,24,67,BLUE,4);a.text("Daily Spend",33,66,15,GRAY,false);a.line(274,52,274,67,0xffcecece,4);a.text("Daily Earn",283,66,15,GRAY,false);
            for(int i=0;i<7;i++){JSONObject row=rows==null?new JSONObject():rows.optJSONObject(i);float xx=28+i*57,bottom=158;float bh=(float)(row.optDouble("value",0)/max*62),eh=(float)(row.optDouble("earned",0)/max*62);a.round(xx,bottom-Math.max(1,bh),10,Math.max(1,bh),5,BLUE);a.round(xx+14,bottom-Math.max(1,eh),10,Math.max(1,eh),5,0xffcecece);a.center(row.optString("label",new String[]{"Mon","Tue","Wed","Thu","Fri","Sat","Sun"}[i]),xx+12,182,13,GRAY,false);}
        }else if(kind.equals("sendreceive")){
            a.text(d.optString("weekday","Today"),20,36,18,Color.WHITE,false);a.text(d.optString("dateLabel",""),20,59,13,Color.WHITE,false);
            for(int i=0;i<2;i++){float y=81+i*62;a.p.setStyle(Paint.Style.STROKE);a.p.setColor(Color.WHITE);a.p.setStrokeWidth(1.2f);canvas.drawRoundRect(19,y,201,y+49,25,25,a.p);a.p.setStyle(Paint.Style.FILL);a.circle(47,y+24,16,Color.WHITE);a.arrow(47,y+24,15,0xff1256aa,i==1);a.text(i==0?"Send":"Receive",72,y+32,24,Color.WHITE,false);}
        }
        return b;
    }
    private static JSONArray topCategories(JSONArray source,int limit){
        JSONArray result=new JSONArray();double others=0;for(int i=0;i<source.length();i++){if(i<limit)result.put(source.optJSONObject(i));else others+=source.optJSONObject(i).optDouble("total",0);}
        if(others>0)try{result.put(new JSONObject().put("name","Others").put("total",others));}catch(JSONException ignored){}return result;
    }
    public static void updateAllWidgets(Context c){AppWidgetManager m=AppWidgetManager.getInstance(c);Class<?>[] classes={MonthReportWidgetProvider.class,TodaySpendWidgetProvider.class,SpendingWidgetProvider.class,AddExpenseWidgetProvider.class,SmartSavingsWidgetProvider.class,WalletCardWidgetProvider.class,DailyCompareWidgetProvider.class,SendReceiveWidgetProvider.class};String[] kinds={"monthreport","todayspend","spending","addexpense","smartsavings","walletcard","dailycompare","sendreceive"};for(int n=0;n<classes.length;n++)for(int id:m.getAppWidgetIds(new ComponentName(c,classes[n])))update(c,m,id,kinds[n]);}
}
