package com.albunyan.rental;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(PrinterPlugin.class);
    registerPlugin(UpdaterPlugin.class);
    super.onCreate(savedInstanceState);
    // A tablet (smallest side 600dp or more) always runs sideways, either way
    // round; a phone keeps following how it's held.
    if (getResources().getConfiguration().smallestScreenWidthDp >= 600) {
      setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
    }
  }
}
