package com.albunyan.rental;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Prints the current page with Android's print system (any printer or "Save as PDF")
// on A4 — same look as the laptop (the same print CSS). Copied from the old app's tablet.
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {
  @PluginMethod
  public void print(PluginCall call) {
    final String name = call.getString("name", "Al Bunyan");
    getActivity().runOnUiThread(() -> {
      try {
        WebView webView = getBridge().getWebView();
        PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
        // No Android margins — they come from the print CSS (8 mm) only; margins on
        // top of margins narrowed the page and cut it or split it over two sheets.
        PrintAttributes attributes = new PrintAttributes.Builder()
          .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asPortrait())
          .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
          .build();
        printManager.print(name, adapter, attributes);
        call.resolve();
      } catch (Exception e) {
        call.reject(e.getMessage());
      }
    });
  }
}
