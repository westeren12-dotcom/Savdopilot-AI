export interface VoicePipeline {
  speechToText(blob: Blob): Promise<string>
  textToSpeech(text: string): Promise<Blob | null>
}

export const demoVoice: VoicePipeline = {
  async speechToText() {
    return 'Pepperoni pizzadan 2 ta buyurtma qilmoqchiman'
  },
  async textToSpeech() {
    return null
  },
}

export function getVoicePipeline(): VoicePipeline {
  return demoVoice
}
