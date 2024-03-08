import { protocol } from 'electron'
import * as path from 'path'
import { readFile } from 'fs'
import { URL } from 'url'

export default (scheme, customProtocol) => {
  (customProtocol || protocol).registerBufferProtocol(
    scheme,
    (request, respond) => {
      let url = request.url;
      // 解决无法加载 app://font/xxx 对应的字体等
      if (url.startsWith('app://') && !url.startsWith('app://./')){
        url = url.replace('app://', 'app://./')
      }
      let pathName = new URL(url).pathname
      pathName = decodeURI(pathName) // Needed in case URL contains spaces

      readFile(path.join(__dirname, pathName), (error, data) => {
        if (error) {
          console.error(
            `Failed to read ${pathName} on ${scheme} protocol`,
            error
          )
        }
        const extension = path.extname(pathName).toLowerCase()
        let mimeType = ''

        if (extension === '.js') {
          mimeType = 'text/javascript'
        } else if (extension === '.html') {
          mimeType = 'text/html'
        } else if (extension === '.css') {
          mimeType = 'text/css'
        } else if (extension === '.svg' || extension === '.svgz') {
          mimeType = 'image/svg+xml'
        } else if (extension === '.json') {
          mimeType = 'application/json'
        } else if (extension === '.wasm') {
          mimeType = 'application/wasm'
        }

        respond({ mimeType, data })
      })
    }
  )
}
