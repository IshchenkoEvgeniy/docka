package app.doska

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

/**
 * Мост «Доски» к Android для веб-части (window.DoskaAndroid):
 * доступ ко всем файлам — чтобы папка проектов могла лежать в общей памяти рядом с Syncthing,
 * и «Поделиться → Доска» — текст и картинки из других приложений.
 */
class DoskaBridge(private val activity: Activity) {
  private val shared = mutableListOf<JSONObject>()
  private var webView: WebView? = null

  fun attach(view: WebView) {
    webView = view
  }

  @JavascriptInterface
  fun hasAllFilesAccess(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager()
    } else {
      activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
        PackageManager.PERMISSION_GRANTED
    }

  /** Открывает системный экран «Доступ ко всем файлам» (Android 11+) или спрашивает разрешение. */
  @JavascriptInterface
  fun requestAllFilesAccess() {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val forApp = Intent(
          Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
          Uri.parse("package:" + activity.packageName),
        )
        try {
          activity.startActivity(forApp)
        } catch (error: Exception) {
          activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        }
      } else {
        activity.requestPermissions(
          arrayOf(
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
          ),
          REQUEST_STORAGE,
        )
      }
    }
  }

  /** Корень общей памяти, обычно /storage/emulated/0. */
  @JavascriptInterface
  fun externalStorageRoot(): String = Environment.getExternalStorageDirectory().absolutePath

  /** Полученное через «Поделиться» (JSON-массив); после чтения очищается. */
  @JavascriptInterface
  fun takeShared(): String =
    synchronized(shared) {
      val array = JSONArray(shared)
      shared.clear()
      array.toString()
    }

  fun takeIntent(intent: Intent?) {
    if (intent == null) return
    val items = when (intent.action) {
      Intent.ACTION_SEND -> readSingle(intent)
      Intent.ACTION_SEND_MULTIPLE -> readMultiple(intent)
      else -> emptyList()
    }
    if (items.isEmpty()) return
    synchronized(shared) { shared.addAll(items) }
    // Чтобы при повороте экрана то же самое не добавилось второй раз.
    intent.action = Intent.ACTION_MAIN
    webView?.post {
      webView?.evaluateJavascript("window.dispatchEvent(new Event('doska-shared'))", null)
    }
  }

  private fun readSingle(intent: Intent): List<JSONObject> {
    val result = mutableListOf<JSONObject>()
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    if (text != null) result.add(JSONObject().put("kind", "text").put("text", text))
    val uri = streamOf(intent)
    if (uri != null) readFile(uri)?.let { result.add(it) }
    return result
  }

  @Suppress("DEPRECATION")
  private fun streamOf(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }

  @Suppress("DEPRECATION")
  private fun readMultiple(intent: Intent): List<JSONObject> {
    val uris: List<Uri> =
      if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
      } ?: emptyList()
    return uris.mapNotNull { readFile(it) }
  }

  private fun readFile(uri: Uri): JSONObject? =
    try {
      val resolver = activity.contentResolver
      val mime = resolver.getType(uri) ?: "application/octet-stream"
      val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
      if (bytes == null || bytes.size > MAX_BYTES) {
        null
      } else {
        var name = "file"
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
          if (cursor.moveToFirst()) name = cursor.getString(0) ?: name
        }
        JSONObject()
          .put("kind", "file")
          .put("name", name)
          .put("mime", mime)
          .put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
      }
    } catch (error: Exception) {
      null
    }

  companion object {
    private const val MAX_BYTES = 30 * 1024 * 1024
    private const val REQUEST_STORAGE = 4201
  }
}
