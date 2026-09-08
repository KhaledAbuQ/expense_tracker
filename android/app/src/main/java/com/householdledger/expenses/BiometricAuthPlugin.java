package com.householdledger.expenses;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {

    private static final String PREFS_NAME = "pocket_expenses_biometrics";
    private static final String KEY_ALIAS = "PocketExpensesBiometricsKey";
    private static final String KEY_EMAIL = "saved_email";
    private static final String KEY_IV = "saved_iv";
    private static final String KEY_PASSWORD = "saved_password";
    private static final String KEY_ENABLED = "biometrics_enabled";
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
        );
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build();
        keyGenerator.init(spec);
        return keyGenerator.generateKey();
    }

    private String encrypt(String plaintext, SharedPreferences.Editor editor) throws Exception {
        SecretKey secretKey = getOrCreateKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] iv = cipher.getIV();
        byte[] encryptedBytes = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        editor.putString(KEY_IV, Base64.encodeToString(iv, Base64.DEFAULT));
        return Base64.encodeToString(encryptedBytes, Base64.DEFAULT);
    }

    private String decrypt(String encryptedBase64, String ivBase64) throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        SecretKey secretKey = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (secretKey == null) {
            throw new IllegalStateException("Secret key not found in KeyStore");
        }

        byte[] iv = Base64.decode(ivBase64, Base64.DEFAULT);
        byte[] encryptedBytes = Base64.decode(encryptedBase64, Base64.DEFAULT);

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        GCMParameterSpec gcmSpec = new GCMParameterSpec(128, iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);
        byte[] decryptedBytes = cipher.doFinal(encryptedBytes);
        return new String(decryptedBytes, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        BiometricManager biometricManager = BiometricManager.from(context);
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG |
                BiometricManager.Authenticators.BIOMETRIC_WEAK;
        int canAuth = biometricManager.canAuthenticate(authenticators);

        boolean isHardwareAvailable = (canAuth != BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE &&
                canAuth != BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE);
        boolean isEnrolled = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isEnabled = prefs.getBoolean(KEY_ENABLED, false);
        boolean hasPassword = prefs.contains(KEY_PASSWORD) && prefs.contains(KEY_IV);
        boolean hasSavedCredentials = isEnabled && hasPassword;
        String savedEmail = hasSavedCredentials ? prefs.getString(KEY_EMAIL, "") : "";

        JSObject ret = new JSObject();
        ret.put("isAvailable", isHardwareAvailable);
        ret.put("isEnrolled", isEnrolled);
        ret.put("hasSavedCredentials", hasSavedCredentials);
        ret.put("savedEmail", savedEmail);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveCredentials(PluginCall call) {
        String email = call.getString("email", "");
        String password = call.getString("password", "");

        if (email.isEmpty() || password.isEmpty()) {
            call.reject("Email and password must be provided.");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            String encryptedPassword = encrypt(password, editor);

            editor.putString(KEY_EMAIL, email);
            editor.putString(KEY_PASSWORD, encryptedPassword);
            editor.putBoolean(KEY_ENABLED, true);
            editor.apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to securely store credentials: " + e.getMessage());
        }
    }

    @PluginMethod
    public void authenticateAndGetCredentials(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Activity is not a FragmentActivity.");
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        boolean isEnabled = prefs.getBoolean(KEY_ENABLED, false);
        String savedEmail = prefs.getString(KEY_EMAIL, null);
        String encryptedPassword = prefs.getString(KEY_PASSWORD, null);
        String ivBase64 = prefs.getString(KEY_IV, null);

        if (!isEnabled || savedEmail == null || encryptedPassword == null || ivBase64 == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "No credentials saved");
            call.resolve(ret);
            return;
        }

        String title = call.getString("title", "Biometric Sign-In");
        String subtitle = call.getString("subtitle", "Confirm your fingerprint or face to sign in");
        String cancelText = call.getString("cancelText", "Use Password");

        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(context);
                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        boolean isCanceled = (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                                errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                                errorCode == BiometricPrompt.ERROR_CANCELED);
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("canceled", isCanceled);
                        ret.put("error", errString.toString());
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        try {
                            String decryptedPassword = decrypt(encryptedPassword, ivBase64);
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            ret.put("email", savedEmail);
                            ret.put("password", decryptedPassword);
                            call.resolve(ret);
                        } catch (Exception e) {
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", "Failed to decrypt credentials: " + e.getMessage());
                            call.resolve(ret);
                        }
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                    }
                });

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(cancelText)
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG |
                                BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                call.reject("Biometric authentication error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Activity is not a FragmentActivity.");
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        Context context = getContext();

        String title = call.getString("title", "Unlock Pocket Expenses");
        String subtitle = call.getString("subtitle", "Confirm your fingerprint or face to unlock");
        String cancelText = call.getString("cancelText", "Use Password");

        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(context);
                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        boolean isCanceled = (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                                errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                                errorCode == BiometricPrompt.ERROR_CANCELED);
                        JSObject ret = new JSObject();
                        ret.put("success", false);
                        ret.put("canceled", isCanceled);
                        ret.put("error", errString.toString());
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                    }
                });

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButtonText(cancelText)
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG |
                                BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                call.reject("Biometric prompt error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void clearCredentials(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();
        try {
            KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception ignored) {
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
