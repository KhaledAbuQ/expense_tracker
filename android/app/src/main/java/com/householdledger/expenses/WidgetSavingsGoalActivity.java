package com.householdledger.expenses;
import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.text.InputType;
import android.widget.EditText;
public class WidgetSavingsGoalActivity extends Activity {
 @Override public void onCreate(Bundle state){super.onCreate(state);SharedPreferences p=getSharedPreferences(PocketExpensesWidgetProvider.PREFS_NAME,Context.MODE_PRIVATE);EditText input=new EditText(this);input.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);input.setHint("Savings goal in JOD");float current=p.getFloat("savings_goal",0);if(current>0)input.setText(String.valueOf(current));AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Savings goal (JOD)").setView(input).setPositiveButton("Save",null).setNegativeButton("Cancel",(d,w)->finish()).create();dialog.setOnCancelListener(d->finish());dialog.setOnShowListener(d->dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{float value=Float.parseFloat(input.getText().toString());if(value<=0||Float.isInfinite(value)||Float.isNaN(value))throw new NumberFormatException();p.edit().putFloat("savings_goal",value).apply();FinanceWidgetProvider.updateAllWidgets(this);dialog.dismiss();finish();}catch(NumberFormatException e){input.setError("Enter a positive amount");}}));dialog.show();}
}
