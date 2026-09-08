import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const android = path.join(root, 'android')
const signing = path.join(android, '.signing')
const keystore = path.join(signing, 'pocket-expenses.jks')
const passwordFile = path.join(signing, 'password')
const env = { ...process.env }
if (!env.JAVA_HOME && process.platform === 'darwin') {
  const java = spawnSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' })
  if (java.status === 0) env.JAVA_HOME = java.stdout.trim()
}
if (process.platform === 'win32') {
  const winJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  if (existsSync(winJbr)) {
    env.JAVA_HOME = winJbr
    env.PATH = `${path.join(winJbr, 'bin')};${env.PATH}`
  }
}
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && process.platform === 'win32') {
  const winSdk = path.join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')
  if (existsSync(winSdk)) env.ANDROID_HOME = winSdk
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

mkdirSync(signing, { recursive: true, mode: 0o700 })
if (existsSync(keystore) !== existsSync(passwordFile)) {
  throw new Error('Incomplete Android signing material. Restore android/.signing from your backup before building.')
}
if (!existsSync(keystore)) {
  writeFileSync(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 })
  const keytool = env.JAVA_HOME ? path.join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool'
  run(keytool, ['-genkeypair', '-keystore', keystore, '-storetype', 'JKS', '-alias', 'pocket-expenses',
    '-storepass:file', passwordFile, '-keypass:file', passwordFile,
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Pocket Expenses'])
  chmodSync(keystore, 0o600)
}

run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [
  '--no-daemon', '--console=plain', '--gradle-user-home', path.join(root, '.gradle-local'),
  'assembleRelease', 'lintRelease',
], android)
mkdirSync(path.join(root, 'artifacts'), { recursive: true })
const destination = path.join(root, 'artifacts', 'pocket-expenses.apk')
copyFileSync(path.join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), destination)
console.log(`\nStandalone APK: ${destination}\nKeep android/.signing backed up to sign future updates with the same key.`)
