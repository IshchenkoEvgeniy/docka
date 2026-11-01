package app.doska

import android.app.Activity
import android.content.Intent
import android.util.Base64
import android.webkit.WebView
import org.json.JSONObject

/** Сохранение производного файла через системный выбор места без разрешения на общую память. */
class ExportDocument(private val activity: Activity, private val view: () -> WebView?) {
  private data class Pending(val id: String, val bytes: ByteArray)
  private var pending: Pending? = null

  fun save(name: String, mime: String, base64: String, id: String) {
    try {
      require(base64.length <= 70 * 1024 * 1024) { "Файл экспорта слишком большой" }
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      activity.runOnUiThread {
        if (pending != null) {
          reply(id, false, "Уже открыт выбор файла")
        } else {
          pending = Pending(id, bytes)
          try {
            activity.startActivityForResult(
              Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime)
                .putExtra(Intent.EXTRA_TITLE, name),
              REQUEST_EXPORT,
            )
          } catch (error: Exception) {
            pending = null
            reply(id, false, error.message ?: "Не удалось выбрать файл")
          }
        }
      }
    } catch (error: Exception) {
      reply(id, false, error.message ?: "Не удалось подготовить экспорт")
    }
  }

  fun finish(requestCode: Int, resultCode: Int, intent: Intent?): Boolean {
    if (requestCode != REQUEST_EXPORT) return false
    val request = pending ?: return true
    pending = null
    val uri = intent?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      reply(request.id, false, null)
      return true
    }
    Thread {
      try {
        val stream = activity.contentResolver.openOutputStream(uri, "wt")
          ?: throw IllegalStateException("Не удалось открыть файл")
        stream.use { it.write(request.bytes) }
        reply(request.id, true, null)
      } catch (error: Exception) {
        reply(request.id, false, error.message ?: "Не удалось записать файл")
      }
    }.start()
    return true
  }

  private fun reply(id: String, saved: Boolean, error: String?) {
    val result = JSONObject().put("id", id).put("saved", saved)
    if (error != null) result.put("error", error)
    view()?.post {
      view()?.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('doska-export-result', {detail: $result}))", null,
      )
    }
  }

  companion object { private const val REQUEST_EXPORT = 4202 }
}
