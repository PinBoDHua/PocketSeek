package com.pocketseek.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * API Key 的 Android Keystore 加密存储：AES/GCM 密钥不可导出，密文放独立 SharedPreferences。
 * WebView 的 localStorage、云备份都不再包含明文 Key；备份规则同时排除该 prefs 文件。
 */
@CapacitorPlugin(name = "SecureKeyStore")
public class SecureKeyStorePlugin extends Plugin {
    private static final String PREFS_NAME = "pocketseek_secure";
    private static final String PREF_KEY = "api_key";
    private static final String KEY_ALIAS = "pocketseek_api_key";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("value", readValue());
        } catch (Exception error) {
            // Keystore 密钥失效（恢复备份、清除凭据等）时清掉不可解密的密文，按未设置处理。
            clear();
            result.put("value", null);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.isEmpty()) {
            call.reject("value is required");
            return;
        }
        try {
            writeValue(value);
            call.resolve();
        } catch (Exception error) {
            call.reject("failed to store api key");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        clear();
        call.resolve();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String readValue() throws Exception {
        String payload = prefs().getString(PREF_KEY, null);
        if (payload == null) {
            return null;
        }
        int separator = payload.indexOf(':');
        if (separator <= 0 || separator == payload.length() - 1) {
            throw new IllegalStateException("invalid payload");
        }
        byte[] iv = Base64.decode(payload.substring(0, separator), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(payload.substring(separator + 1), Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }

    private void writeValue(String value) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String payload =
                Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                        + ":"
                        + Base64.encodeToString(ciphertext, Base64.NO_WRAP);
        if (!prefs().edit().putString(PREF_KEY, payload).commit()) {
            throw new IllegalStateException("failed to persist");
        }
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator =
                    KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(
                    new KeyGenParameterSpec.Builder(
                                    KEY_ALIAS,
                                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                            .setRandomizedEncryptionRequired(true)
                            .build());
            generator.generateKey();
        }
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private void clear() {
        prefs().edit().remove(PREF_KEY).commit();
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS);
            }
        } catch (Exception ignored) {
            // 删除失败会在下次读取时再次触发解密失败并重试清理。
        }
    }
}