package com.pokerface.game;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Запрашиваем камеру/микрофон заранее, чтобы WebView (Capacitor) сразу
        // мог выдать getUserMedia веб-версии (детект улыбки + видео LiveKit).
        String[] perms = { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO };
        boolean need = false;
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                need = true;
                break;
            }
        }
        if (need) {
            ActivityCompat.requestPermissions(this, perms, 100);
        }
    }
}
