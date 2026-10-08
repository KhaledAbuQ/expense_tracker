package com.householdledger.expenses;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.*;
import android.graphics.*;
import android.os.Bundle;
import android.os.Build;
import android.util.SizeF;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
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
    public static void update(Context c,AppWidgetManager m,int id,String kind){
        SharedPreferences p=prefs(c);JSONObject data;
        try{data=new JSONObject(p.getString("finance_snapshot","{}"));}catch(JSONException e){data=new JSONObject();}
        Bundle options=m.getAppWidgetOptions(id);
        boolean adaptive=true;
        if(adaptive && Build.VERSION.SDK_INT>=31){
            ArrayList<SizeF> sizes=options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if(sizes!=null&&!sizes.isEmpty()){
                Map<SizeF,RemoteViews> layouts=new LinkedHashMap<>();
                for(SizeF size:sizes){
                    if(layouts.size()>=8)break;
                    layouts.put(size,views(c,kind,data,p,Math.max(150,Math.round(size.getWidth())),Math.max(minimumHeight(kind),Math.round(size.getHeight()))));
                }
                m.updateAppWidget(id,new RemoteViews(layouts));return;
            }
        }
        int minW=Math.max(150,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,180));
        int minH=Math.max(minimumHeight(kind),options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,180));
        int maxW=Math.max(minW,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,minW));
        int maxH=Math.max(minH,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,minH));
        if(adaptive)m.updateAppWidget(id,new RemoteViews(views(c,kind,data,p,maxW,minH),views(c,kind,data,p,minW,maxH)));
        else m.updateAppWidget(id,views(c,kind,data,p,minW,minH));
    }
    private static RemoteViews views(Context c,String kind,JSONObject data,SharedPreferences p,int w,int h){
        w=Math.min(800,w);h=Math.min(800,h);
        boolean adaptive=true;
        int layout=R.layout.widget_adaptive_finance;
        if(kind.equals("walletcard"))layout=R.layout.widget_wallet_adaptive;
        else if(isRightActionBar(kind,w,h))layout=R.layout.widget_today_bar;
        else if(kind.equals("sendreceive"))layout=isWide(w,h)?R.layout.widget_send_horizontal:R.layout.widget_send_vertical;
        RemoteViews v=new RemoteViews(c.getPackageName(),layout);
        v.setImageViewBitmap(R.id.reference_widget_art,render(kind,data,p,w,h));
        v.setContentDescription(R.id.reference_widget_art,kind+" · "+p.getString("month_label","This month")+" · monthly spending "+p.getString("month_total","JOD 0.000"));
        String action=kind.equals("todayspend")||kind.equals("quickactions")?"expenses":kind.equals("smartsavings")?"savings":"home";
        v.setOnClickPendingIntent(R.id.reference_widget_root,launch(c,action,610+action.hashCode()));
        if(kind.equals("sendreceive")){
            v.setViewVisibility(R.id.reference_widget_primary,View.VISIBLE);v.setViewVisibility(R.id.reference_widget_secondary,View.VISIBLE);
            v.setOnClickPendingIntent(R.id.reference_widget_primary,launch(c,"transfers",611));
            v.setOnClickPendingIntent(R.id.reference_widget_secondary,launch(c,"income",612));
        }
        if(hasAdd(kind)||kind.equals("smartsavings")){
            String footerAction=hasAdd(kind)?"add_expense":"savings_goal";
            v.setContentDescription(R.id.reference_widget_footer,hasAdd(kind)?"Add expense":"Open Savings Goal Planner");
            v.setOnClickPendingIntent(R.id.reference_widget_footer,launch(c,footerAction,613+footerAction.hashCode()));
            v.setContentDescription(R.id.reference_widget_art,hasAdd(kind)?"Spending JOD "+amount(data.optDouble("todayAmount",0))+", "+data.optInt("todayCount",0)+" transactions":"Savings JOD "+amount(data.optDouble("savingsAmount",0))+", goal JOD "+amount(data.optDouble("savingsGoal",0)));
        }
        if(!hasAdd(kind)&&!kind.equals("smartsavings")&&!kind.equals("walletcard")&&!kind.equals("sendreceive"))v.setViewVisibility(R.id.reference_widget_footer,View.GONE);
        if(kind.equals("walletcard")){
            Intent toggle=new Intent(c,WalletCardWidgetProvider.class).setAction(PRIVACY);
            v.setViewVisibility(R.id.reference_widget_footer,View.VISIBLE);v.setContentDescription(R.id.reference_widget_footer,p.getBoolean("wallet_hidden",true)?"Show bank balance":"Hide bank balance");
            v.setOnClickPendingIntent(R.id.reference_widget_footer,PendingIntent.getBroadcast(c,614,toggle,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        }
        return v;
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
    private static int minimumHeight(String kind){return kind.equals("monthreport")||kind.equals("dailycompare")||kind.equals("sendreceive")?90:48;}
    private static boolean hasAdd(String kind){return kind.equals("todayspend")||kind.equals("pocket")||kind.equals("quickactions");}
    private static boolean isWide(float w,float h){return w>h*1.4f;}
    private static boolean isRightActionBar(String kind,float w,float h){return (hasAdd(kind)||kind.equals("smartsavings"))&&(h<90||(h<=140&&isWide(w,h)));}
    private static Bitmap render(String kind,JSONObject d,SharedPreferences prefs,int width,int height){
        if(kind.equals("todayspend")||kind.equals("smartsavings"))return renderAdaptive(kind,d,width,height);
        // Draw at the actual launcher size; geometry and detail change with available space.
        float density=width*height>150000?1:2;
        Bitmap bitmap=Bitmap.createBitmap(Math.round(width*density),Math.round(height*density),Bitmap.Config.ARGB_8888);
        Canvas c=new Canvas(bitmap);c.scale(density,density);
        float w=width,h=height,pad=Math.min(20,Math.min(w,h)*.1f),r=Math.min(28,Math.min(w,h)*.2f);
        Art a=new Art(c,w,h);boolean wide=isWide(w,h),compact=h<150;
        a.gradient(0,0,w,h,r,Color.WHITE,0xfff6faff);
        double spending=d.optDouble("monthAmount",0),earning=d.optDouble("monthIncome",0),available=d.optDouble("availableAmount",0);
        JSONArray cats=topCategories(d.optJSONArray("categories")==null?new JSONArray():d.optJSONArray("categories"),5);
        if(kind.equals("pocket")||kind.equals("quickactions")){
            boolean quick=kind.equals("quickactions"),bar=isRightActionBar(kind,w,h);
            String total=prefs.getString(quick?QuickActionsWidgetProvider.KEY_TODAY_TOTAL:PocketExpensesWidgetProvider.KEY_MONTH_TOTAL,"JOD 0.000");
            float content=bar?w-pad-72:w-pad*2,baseline=bar?(h<70?h-11:h*.56f):Math.min(h*.3f,70);
            a.fit(quick?"TODAY'S SPENT":prefs.getString("month_label","Spent this month"),pad,pad+10,compact?9:13,content,GRAY,false);
            a.fit(total,pad,baseline,Math.min(36,h*.35f),content,INK,true);
            if(bar){drawAdd(a,w-32,h/2,Math.min(48,h-8),true);return bitmap;}
            float footerY=h-48;
            if(!quick&&h>=180){
                float gap=10,chipW=(w-pad*2-gap)/2,y=Math.min(h*.43f,baseline+35);
                for(int i=0;i<2;i++){float x=pad+i*(chipW+gap);a.round(x,y,chipW,32,10,i==0?0xfff1eeff:0xfffff3ee);a.fit(prefs.getString(i==0?"dining_total":"grocery_total","JOD 0.000"),x+8,y+21,14,chipW-16,INK,false);}
                if(footerY-y>=85){a.text("Today",pad,footerY-37,12,GRAY,false);a.fit(prefs.getString(QuickActionsWidgetProvider.KEY_TODAY_TOTAL,"JOD 0.000"),pad,footerY-13,23,w-pad*2,INK,true);}
            }else if(quick&&h>=180)a.fit(d.optInt("todayCount",0)+" transactions today",pad,h*.52f,13,w-pad*2,GRAY,false);
            a.round(pad,footerY+6,w-pad*2,36,18,0xff202124);a.center("+ Add expense",w/2,footerY+29,13,Color.WHITE,true);
        }else if(kind.equals("sendreceive")){
            a.gradient(0,0,w,h,r,0xff007eff,0xff104c91);
            a.fit(d.optString("weekday","Today")+"  "+d.optString("dateLabel",""),pad,23,12,w-pad*2,Color.WHITE,false);
            float top=32,body=h-top,cellW=wide?w/2:w,cellH=wide?body:body/2;
            for(int i=0;i<2;i++){
                float x=wide?i*cellW:0,y=top+(wide?0:i*cellH),bh=Math.max(8,cellH-12),bw=cellW-16;
                a.round(x+8,y+6,bw,bh,Math.min(24,bh/2),0xff246bc0);
                float icon=Math.min(16,bh*.32f),cx=x+8+icon+8,cy=y+cellH/2;
                a.circle(cx,cy,icon,Color.WHITE);a.arrow(cx,cy,icon,0xff1256aa,i==1);
                a.fit(i==0?"Send":"Receive",cx+icon+8,cy+5,Math.min(25,bh*.35f),bw-icon*2-24,Color.WHITE,false);
            }
        }else if(kind.equals("walletcard")){
            a.gradient(0,0,w,h,r,0xff007eff,0xff104c91);
            boolean hidden=prefs.getBoolean("wallet_hidden",true);float labelY=pad+10,valueY=h<90?h-20:h*.72f;
            if(h>=150){
                float cardH=Math.min(h*.4f,115);a.gradient(pad,pad,w-pad*2,cardH,12,0xfffafafa,0xffe5e7ee);
                a.text("BANK",pad+12,pad+25,16,0xff10268c,true);
                float pocketY=pad+cardH*.6f;Path pocket=new Path();pocket.moveTo(0,pocketY);pocket.lineTo(w*.34f,pocketY);pocket.cubicTo(w*.4f,pocketY,w*.4f,pocketY+20,w*.5f,pocketY+20);pocket.cubicTo(w*.6f,pocketY+20,w*.6f,pocketY,w*.66f,pocketY);pocket.lineTo(w,pocketY);pocket.lineTo(w,h);pocket.lineTo(0,h);pocket.close();a.p.setColor(BLUE);c.drawPath(pocket,a.p);labelY=pad+cardH+18;
            }
            a.text("BALANCE",pad,labelY,10,Color.WHITE,true);
            a.fit(hidden?"* * * *":amount(d.optDouble("bankAmount",0)),pad,valueY,Math.min(36,h*.22f),w-pad*2-42,Color.WHITE,true);
            a.fit(hidden?"Balance hidden":"Bank account",pad,h-7,9,w-pad*2-42,0xffe7f1ff,false);
            float eyeX=w-32,eyeY=h-24;
            a.circle(eyeX,eyeY,18,0xffffffff);
            RectF eye=new RectF(eyeX-10,eyeY-6,eyeX+10,eyeY+6);
            a.arc(eye,0,180,0xff1256aa,2);a.arc(eye,180,180,0xff1256aa,2);a.circle(eyeX,eyeY,3,0xff1256aa);
            if(hidden)a.line(eyeX-11,eyeY+10,eyeX+11,eyeY-10,0xff1256aa,2);
        }else if(kind.equals("spending")){
            float valueY=h<90?h-12:h-18;
            a.text("SPENDING",pad,pad+10,10,GRAY,true);
            if(h>=90){
                float y=pad+24,railW=w-pad*2;a.round(pad,y,railW,compact?14:26,7,0xffeeeeee);float x=pad;
                for(int i=0;i<cats.length();i++){float segment=spending>0?(float)(cats.optJSONObject(i).optDouble("total",0)/spending*railW):0;if(segment>0)a.round(x,y,segment,compact?14:26,0,COLORS[i%6]);x+=segment;}
                if(h>=190){int cols=w>=300?3:2;int rows=(cats.length()+cols-1)/cols;float cell=railW/cols;
                    for(int i=0;i<cats.length();i++){float xx=pad+(i%cols)*cell,yy=y+48+(i/cols)*24;if(yy>h-66)break;a.circle(xx+4,yy-4,4,COLORS[i%6]);a.fit(cats.optJSONObject(i).optString("name","Other"),xx+13,yy,11,cell-18,GRAY,false);}
                    if(cats.length()==0)a.text("No spending yet",pad,y+48,12,GRAY,false);
                }
                if(h>=150)a.text("AVAILABLE · JOD",pad,valueY-28,10,GRAY,true);
            }
            a.fit(amount(available),pad,valueY,Math.min(32,h*.25f),w-pad*2,INK,true);
        }else if(kind.equals("dailycompare")){
            JSONArray rows=d.optJSONArray("week");double spent=0,earned=0,max=1;
            for(int i=0;rows!=null&&i<rows.length();i++){JSONObject row=rows.optJSONObject(i);spent+=row.optDouble("value",0);earned+=row.optDouble("earned",0);max=Math.max(max,Math.max(row.optDouble("value",0),row.optDouble("earned",0)));}
            float half=(w-pad*2)/2;
            a.text("SPEND",pad,pad+9,9,GRAY,true);a.text("EARN",pad+half,pad+9,9,GRAY,true);
            a.fit(amount(spent),pad,pad+32,Math.min(28,w*.065f),half-8,INK,true);a.fit(amount(earned),pad+half,pad+32,Math.min(28,w*.065f),half-8,INK,true);
            float bottom=h-25,chartTop=pad+48,chartH=Math.max(8,bottom-chartTop),step=(w-pad*2)/7,bar=Math.min(12,step*.25f);
            for(int i=0;i<7;i++){JSONObject row=rows!=null&&i<rows.length()?rows.optJSONObject(i):new JSONObject();float x=pad+i*step+step*.17f,bh=(float)(row.optDouble("value",0)/max*chartH),eh=(float)(row.optDouble("earned",0)/max*chartH);a.round(x,bottom-Math.max(1,bh),bar,Math.max(1,bh),bar/2,BLUE);a.round(x+bar+3,bottom-Math.max(1,eh),bar,Math.max(1,eh),bar/2,0xffcecece);a.center(row.optString("label",new String[]{"Mon","Tue","Wed","Thu","Fri","Sat","Sun"}[i]),pad+(i+.5f)*step,h-8,Math.min(12,step*.32f),GRAY,false);}
        }else if(kind.equals("monthreport")){
            float header=compact?Math.min(72,h*.62f):Math.min(112,h*.28f);
            a.gradient(0,0,w,header,r,0xff007eff,0xff1057ad);
            a.fit(d.optString("monthName","THIS MONTH"),pad,pad+10,11,w-pad*2,Color.WHITE,true);
            String[] labels={"EARNING","SPENDING","BALANCE"};double[] nums={earning,spending,d.optDouble("monthNet",0)};float cell=(w-pad*2)/3;
            for(int i=0;i<3;i++){float x=pad+i*cell;a.fit(labels[i],x,header-29,9,cell-5,0xffd3e8ff,false);a.fit(amount(nums[i]),x,header-9,Math.min(22,cell*.22f),cell-5,Color.WHITE,true);}
            if(compact){a.fit(cats.length()>0?"Top: "+cats.optJSONObject(0).optString("name","Other"):"No spending yet",pad,h-10,11,w-pad*2,GRAY,false);return bitmap;}
            float weeksH=h>=260?74:0,bodyH=h-header-weeksH;
            boolean side=w>=280||wide;float legendX=side?w*.48f:pad,donutSize=Math.min(side?w*.3f:w*.52f,side?bodyH-32:bodyH*.5f),cx=side?w*.23f:w/2,cy=header+pad+donutSize/2;
            RectF ring=new RectF(cx-donutSize/2,cy-donutSize/2,cx+donutSize/2,cy+donutSize/2);float start=-90;
            if(spending<=0)a.arc(ring,0,360,0xffeeeeee,donutSize*.2f);
            for(int i=0;i<cats.length();i++){float sweep=spending>0?(float)(cats.optJSONObject(i).optDouble("total",0)/spending*360):0;a.arc(ring,start,sweep,COLORS[i%6],donutSize*.2f);start+=sweep;}
            float legendTop=side?header+pad+12:cy+donutSize/2+22,legendBottom=h-weeksH-8;int count=Math.min(cats.length(),Math.max(0,(int)((legendBottom-legendTop)/21)+1));
            for(int i=0;i<count;i++){JSONObject cat=cats.optJSONObject(i);float y=legendTop+i*21;a.circle(legendX+3,y-4,3,COLORS[i%6]);a.fit(cat.optString("name","Other"),legendX+12,y,11,w-legendX-pad-50,GRAY,false);a.fit(String.format(Locale.US,"%.0f%%",spending>0?cat.optDouble("total",0)/spending*100:0),w-pad-35,y,10,35,INK,false);}
            if(cats.length()==0)a.fit("No spending yet",legendX,legendTop,11,w-legendX-pad,GRAY,false);
            if(weeksH>0){JSONArray weeks=d.optJSONArray("weekNet");double max=1;for(int i=0;weeks!=null&&i<weeks.length();i++)max=Math.max(max,Math.abs(weeks.optJSONObject(i).optDouble("value",0)));
                for(int i=0;i<4;i++){double value=weeks!=null&&i<weeks.length()?weeks.optJSONObject(i).optDouble("value",0):0;float x=pad+(i+.5f)*(w-pad*2)/4,bottom=h-26,bh=(float)(Math.abs(value)/max*22);a.fit(value==0?"—":amount(value),x-(w-pad*2)/8,h-58,12,(w-pad*2)/4-4,INK,true);a.round(x-4,bottom-Math.max(2,bh),8,Math.max(2,bh),4,value<0?0xffcecece:BLUE);a.center("W"+(i+1),x,h-9,10,GRAY,false);}
            }
        }
        return bitmap;
    }
    private static void drawAdd(Art a,float cx,float cy,float size,boolean blue){a.gradient(cx-size/2,cy-size/2,size,size,size/2,blue?BLUE:0xff333333,blue?0xff105ab5:0xff111111);a.line(cx-8,cy,cx+8,cy,Color.WHITE,2.5f);a.line(cx,cy-8,cx,cy+8,Color.WHITE,2.5f);}
    private static boolean isTodayBar(String kind,float w,float h){return kind.equals("todayspend") && (h<90 || (h<=140 && w>h*1.4f));}
    private static Bitmap renderAdaptive(String kind,JSONObject d,int width,int height){
        Bitmap bitmap=Bitmap.createBitmap(width*2,height*2,Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(bitmap);canvas.scale(2,2);
        float w=width,h=height,pad=Math.min(20,w*.09f),radius=Math.min(28,Math.min(w,h)*.15f);
        Art a=new Art(canvas,w,h);a.gradient(0,0,w,h,radius,Color.WHITE,0xfff6faff);
        if(kind.equals("smartsavings")&&isRightActionBar(kind,w,h)){
            float inset=Math.min(16,h*.17f),content=w-inset-72,baseline=h<70?h-11:h*.56f;
            a.fit("SAVINGS · JOD",inset,inset+9,9,content,GRAY,true);
            a.fit(amount(d.optDouble("savingsAmount",0)),inset,baseline,Math.min(32,h*.38f),content,INK,true);
            double goal=d.optDouble("savingsGoal",0),balance=d.optDouble("savingsGoalBalance",d.optDouble("savingsAmount",0));
            if(h>=70)a.fit(goal>0?Math.round(Math.max(0,Math.min(1,balance/goal))*100)+"% of goal":"Set a savings goal",inset,baseline+17,10,content,GRAY,false);
            a.round(w-56,h/2-20,48,40,20,0xffeef0ff);a.center("Goal",w-32,h/2+4,11,0xff425bd7,true);return bitmap;
        }
        if(isTodayBar(kind,w,h)){
            float inset=Math.min(16,h*.17f),contentWidth=w-inset-72;
            a.fit(contentWidth>130?"TODAY SPENDING":"TODAY",inset,inset+9,9,contentWidth,GRAY,true);
            float valueY=h<70?h-11:h*.56f;
            a.fit(amount(d.optDouble("todayAmount",0)),inset,valueY,Math.min(32,h*.38f),contentWidth,INK,true);
            if(h>=70)a.fit("JOD · "+d.optInt("todayCount",0)+" transactions",inset,valueY+17,10,contentWidth,GRAY,false);
            float buttonSize=Math.min(48,h-8),cx=w-32,cy=h/2;
            a.gradient(cx-buttonSize/2,cy-buttonSize/2,buttonSize,buttonSize,buttonSize/2,0xff087bfa,0xff105ab5);
            a.line(cx-8,cy,cx+8,cy,Color.WHITE,2.5f);a.line(cx,cy-8,cx,cy+8,Color.WHITE,2.5f);
            return bitmap;
        }
        boolean compact=h<170||w<140,landscape=w>h*1.4f;
        float footer=compact?34:42,footerY=h-footer-6;
        float size=compact?10:13;
        if(kind.equals("todayspend")){
            a.text(compact?"TODAY":"TODAY SPENDING",pad,pad+size,size,GRAY,true);
            double total=d.optDouble("todayAmount",0);int count=d.optInt("todayCount",0);
            float valueY=compact?Math.min(footerY-12,45):landscape?h*.5f:h*.37f;
            a.fit(amount(total),pad,valueY,compact?20:Math.min(36,w*.14f),w-pad*2,INK,true);
            if(!compact){
                a.text("JOD · "+count+" "+(count==1?"transaction":"transactions"),pad,valueY+20,12,GRAY,false);
                JSONArray merchants=d.optJSONArray("todayMerchants");
                if(h>=210&&!landscape){
                    int n=merchants==null?0:Math.min(3,merchants.length());
                    float r=Math.min(23,w*.09f),cy=(valueY+35+footerY)/2;
                    for(int i=0;i<n;i++){
                        float cx=pad+r+i*(r*2+8);a.circle(cx,cy,r,new int[]{0xff151515,0xff00875a,0xff006acb}[i]);
                        String name=merchants.optString(i,"Expense");a.center(name.substring(0,Math.min(2,name.length())).toUpperCase(Locale.US),cx,cy+4,12,Color.WHITE,true);
                    }
                    if(n==0)a.text("No purchases today",pad,cy+4,12,GRAY,false);
                }
            }
            a.gradient(pad,footerY,w-pad*2,footer,radius*.7f,0xff087bfa,0xff105ab5);
            if(compact){a.center("+ Add",w/2,footerY+footer/2+4,12,Color.WHITE,true);return bitmap;}
            float cx=w/2; a.line(cx-43,footerY+footer/2,cx-31,footerY+footer/2,Color.WHITE,2);
            a.line(cx-37,footerY+footer/2-6,cx-37,footerY+footer/2+6,Color.WHITE,2);
            a.text("Add expense",cx-23,footerY+footer/2+4,compact?11:13,Color.WHITE,true);
        }else{
            double balance=d.optDouble("savingsAmount",0),goal=d.optDouble("savingsGoal",0),progressBalance=d.optDouble("savingsGoalBalance",balance);
            float progress=goal>0?(float)Math.max(0,Math.min(1,progressBalance/goal)):0;
            a.text(compact?"SAVINGS":"SMART SAVINGS",pad,pad+size,size,GRAY,true);
            if(compact){
                a.fit(amount(balance),pad,Math.min(footerY-15,44),h<105?17:21,w-pad*2,INK,true);
                a.round(pad,footerY-12,w-pad*2,4,2,0xffe8efff);
                if(progress>0)a.round(pad,footerY-12,(w-pad*2)*progress,4,2,BLUE);
            }else if(landscape){
                float leftW=w*.45f,diameter=Math.min(leftW-pad*2,(footerY-pad-18)*1.3f),cx=leftW/2,cy=pad+30+diameter/2;
                RectF gauge=new RectF(cx-diameter/2,cy-diameter/2,cx+diameter/2,cy+diameter/2);
                a.arc(gauge,180,180,0xffe8efff,Math.max(10,diameter*.13f));a.arc(gauge,180,180*progress,BLUE,Math.max(10,diameter*.13f));
                a.center(goal>0?Math.round(progress*100)+"%":"Set goal",cx,cy-4,15,GRAY,true);
                a.text("BALANCE · JOD",leftW+pad,pad+37,11,GRAY,true);
                a.fit(amount(balance),leftW+pad,pad+67,Math.min(32,h*.15f),w-leftW-pad*2,INK,true);
                if(h>=185)a.fit(goal>0?"Goal "+amount(goal):"Plan your next goal",leftW+pad,pad+91,12,w-leftW-pad*2,GRAY,false);
            }else{
                float diameter=Math.min(w-pad*3,(footerY-65)*1.45f),cx=w/2,cy=pad+34+diameter/2;
                RectF gauge=new RectF(cx-diameter/2,cy-diameter/2,cx+diameter/2,cy+diameter/2);
                a.arc(gauge,180,180,0xffe8efff,Math.max(10,diameter*.13f));a.arc(gauge,180,Math.min(90,180*progress),0xff4047ee,Math.max(10,diameter*.13f));
                if(progress>.5f)a.arc(gauge,270,180*progress-90,0xff5298ff,Math.max(10,diameter*.13f));
                a.center(goal>0?Math.round(progress*100)+"%":"Set goal",cx,cy-9,14,GRAY,true);
                a.text("BALANCE · JOD",pad,footerY-38,11,GRAY,true);a.fit(amount(balance),pad,footerY-12,Math.min(32,w*.14f),w-pad*2,INK,true);
                if(h>=290)a.center(goal>0?"Goal "+amount(goal):"Choose a savings goal",cx,cy+18,12,GRAY,false);
            }
            a.round(pad,footerY,w-pad*2,footer,radius*.7f,0xffeef0ff);
            a.center(compact?"Goal planner":"Open goal planner",w/2,footerY+footer/2+4,compact?10:12,0xff425bd7,true);
        }
        return bitmap;
    }
    private static JSONArray topCategories(JSONArray source,int limit){
        JSONArray result=new JSONArray();double others=0;for(int i=0;i<source.length();i++){if(i<limit)result.put(source.optJSONObject(i));else others+=source.optJSONObject(i).optDouble("total",0);}
        if(others>0)try{result.put(new JSONObject().put("name","Others").put("total",others));}catch(JSONException ignored){}return result;
    }
    public static void updateAllWidgets(Context c){AppWidgetManager m=AppWidgetManager.getInstance(c);Class<?>[] classes={MonthReportWidgetProvider.class,TodaySpendWidgetProvider.class,SpendingWidgetProvider.class,SmartSavingsWidgetProvider.class,WalletCardWidgetProvider.class,DailyCompareWidgetProvider.class,SendReceiveWidgetProvider.class};String[] kinds={"monthreport","todayspend","spending","smartsavings","walletcard","dailycompare","sendreceive"};for(int n=0;n<classes.length;n++)for(int id:m.getAppWidgetIds(new ComponentName(c,classes[n])))update(c,m,id,kinds[n]);}
}
