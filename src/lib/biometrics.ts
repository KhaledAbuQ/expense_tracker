import { registerPlugin, Capacitor } from '@capacitor/core'

export interface BiometricAvailability {
  isAvailable: boolean
  isEnrolled: boolean
  hasSavedCredentials: boolean
  savedEmail?: string
}

export interface BiometricAuthResult {
  success: boolean
  canceled?: boolean
  error?: string
  email?: string
  password?: string
}

export interface BiometricAuthPluginInterface {
  isAvailable(): Promise<BiometricAvailability>
  saveCredentials(options: { email: string; password: string }): Promise<{ success: boolean }>
  authenticateAndGetCredentials(options?: {
    title?: string
    subtitle?: string
    cancelText?: string
  }): Promise<BiometricAuthResult>
  clearCredentials(): Promise<{ success: boolean }>
}

export const BiometricAuth = registerPlugin<BiometricAuthPluginInterface>('BiometricAuth')

export const isNative = () => Capacitor.isNativePlatform()

export async function checkBiometricStatus(): Promise<BiometricAvailability> {
  if (!isNative()) {
    return {
      isAvailable: false,
      isEnrolled: false,
      hasSavedCredentials: false,
    }
  }
  try {
    return await BiometricAuth.isAvailable()
  } catch (err) {
    console.debug('Biometric availability check failed:', err)
    return {
      isAvailable: false,
      isEnrolled: false,
      hasSavedCredentials: false,
    }
  }
}
