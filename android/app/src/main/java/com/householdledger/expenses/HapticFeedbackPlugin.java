package com.householdledger.expenses;

import android.os.Build;
import android.content.Context;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PocketHaptics")
public class HapticFeedbackPlugin extends Plugin {
    @PluginMethod
    public void feedback(PluginCall call) {
        String kind = call.getString("kind", "selection");
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (getActivity() == null) {
                call.resolve();
                return;
            }
            View view = getActivity().getWindow().getDecorView();
            JSObject result = new JSObject();
            if (!view.isHapticFeedbackEnabled() || Settings.System.getInt(
                    getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) == 0) {
                result.put("performed", false);
                call.resolve(result);
                return;
            }
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = manager == null ? null : manager.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                // Short taps for browsing; longer, higher-amplitude pulses for commitments.
                long duration = "navigation".equals(kind) ? 18 : "impact".equals(kind) ? 38 : 12;
                int amplitude = "navigation".equals(kind) ? 100 : "impact".equals(kind) ? 180 : 70;
                boolean outcome = "success".equals(kind) || "error".equals(kind);
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        if (outcome) {
                            boolean error = "error".equals(kind);
                            vibrator.vibrate(VibrationEffect.createWaveform(
                                error ? new long[]{0, 38, 65, 38} : new long[]{0, 22, 55, 32},
                                error ? new int[]{0, 220, 0, 220} : new int[]{0, 150, 0, 200}, -1));
                        } else {
                            vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                        }
                    } else if (outcome) {
                        vibrator.vibrate("error".equals(kind) ? new long[]{0, 38, 65, 38} : new long[]{0, 22, 55, 32}, -1);
                    } else {
                        vibrator.vibrate(duration);
                    }
                    result.put("performed", true);
                    call.resolve(result);
                    return;
                } catch (SecurityException ignored) {
                    // Fall back to system feedback if vibration is restricted on this device.
                }
            }
            int effect = HapticFeedbackConstants.CLOCK_TICK;
            if ("impact".equals(kind)) {
                effect = HapticFeedbackConstants.LONG_PRESS;
            } else if ("navigation".equals(kind)) {
                effect = HapticFeedbackConstants.VIRTUAL_KEY;
            } else if ("success".equals(kind)) {
                effect = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY;
            } else if ("error".equals(kind)) {
                effect = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
            }
            // No override flags: Android's system touch-feedback preference is respected.
            result.put("performed", view.performHapticFeedback(effect));
            call.resolve(result);
        });
    }
}
