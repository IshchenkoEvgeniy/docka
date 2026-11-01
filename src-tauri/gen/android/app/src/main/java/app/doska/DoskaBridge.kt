package app.doska

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.FileProvider
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * Мост «Доски» к Android для веб-части (window.DoskaAndroid):
 * доступ ко всем файлам — чтобы папка проектов могла лежать в общей памяти рядом с Syncthing,
 * «Поделиться → Доска» — текст и картинки из других приложений, открытие файлов проекта.
 */
class DoskaBridge(private val activity: Activity) {
  private val shared = mutableListOf<JSONObject>()
  private var webView: WebView? = null
  private val exports = ExportDocument(activity) { webView }
  private val clipboard = ClipboardReader(activity) { webView }

  @JavascriptInterface
  fun readClipboard(requestId: String) { clipboard.read(requestId) }

  @JavascriptInterface
  fun saveExport(name: String, mime: String, base64: String, requestId: String) {
    exports.save(name, mime, base64, requestId)
  }

  fun finishExport(requestCode: Int, resultCode: Int, data: Intent?): Boolean =
    exports.finish(requestCode, resultCode, data)

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

  /**
   * Открывает файл проекта системной программой (ADR 0005): content:// через FileProvider —
   * file:// другим приложениям Android не отдаёт. false — файла нет или нечем открыть.
   */
  @JavascriptInterface
  fun openFile(path: String, mime: String): Boolean =
    try {
      val file = File(path)
      if (!file.isFile) {
        false
      } else {
        val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
        val view = Intent(Intent.ACTION_VIEW)
          .setDataAndType(uri, mime.ifBlank { "*/*" })
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        val chooser = Intent.createChooser(view, file.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.runOnUiThread { activity.startActivity(chooser) }
        true
      }
    } catch (error: Exception) {
      false
    }

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
    try { readSharedFile(activity, uri) } catch (error: Exception) { null }

  companion object {
    private const val REQUEST_STORAGE = 4201
  }
}
