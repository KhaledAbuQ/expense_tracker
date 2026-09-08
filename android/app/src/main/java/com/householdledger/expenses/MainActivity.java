package com.householdledger.expenses;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BankSmsPlugin.class);
        registerPlugin(ExpenseWidgetPlugin.class);
        registerPlugin(BiometricAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ExpenseWidgetPlugin.handleNewIntent(intent);
    }
}
