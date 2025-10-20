/**
 * Voice Assistant Service
 * Provides text-to-speech and speech-to-text capabilities for the AI Intake Assistant
 * Note: This service provides server-side support, actual Web Speech API runs client-side
 */

import { db } from "../db";
import { intakeSessions, users } from "@shared/schema";
import { eq } from "drizzle-orm";

interface VoiceSettings {
  enabled: boolean;
  language: string;
  voiceName?: string;
  rate: number; // 0.1 to 10
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
  autoSpeak: boolean; // Automatically speak responses
  enableSoundEffects: boolean;
}

interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  profanityFilter: boolean;
}

interface VoiceCommand {
  command: string;
  aliases: string[];
  action: string;
  parameters?: Record<string, any>;
}

interface AccessibilitySettings {
  screenReaderMode: boolean;
  voiceGuidance: boolean;
  audioDescriptions: boolean;
  keyboardShortcuts: boolean;
  highContrastAudio: boolean;
}

class VoiceAssistantService {
  private defaultVoiceSettings: VoiceSettings = {
    enabled: false,
    language: 'en-US',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoSpeak: false,
    enableSoundEffects: true
  };

  private supportedLanguages = {
    'en': 'en-US',
    'es': 'es-US',
    'zh': 'zh-CN',
    'ko': 'ko-KR'
  };

  private voiceCommands: VoiceCommand[] = [
    {
      command: 'help',
      aliases: ['ayuda', '帮助', '도움말', 'assist me', 'what can you do'],
      action: 'showHelp',
      parameters: {}
    },
    {
      command: 'start over',
      aliases: ['restart', 'begin again', 'empezar de nuevo', '重新开始', '다시 시작'],
      action: 'restartSession',
      parameters: {}
    },
    {
      command: 'repeat',
      aliases: ['say again', 'what did you say', 'repetir', '重复', '다시 말해'],
      action: 'repeatLastMessage',
      parameters: {}
    },
    {
      command: 'stop speaking',
      aliases: ['quiet', 'silence', 'pause', 'detener', '停止', '중지'],
      action: 'stopSpeaking',
      parameters: {}
    },
    {
      command: 'speed up',
      aliases: ['faster', 'más rápido', '加快', '빠르게'],
      action: 'adjustSpeed',
      parameters: { rate: 1.5 }
    },
    {
      command: 'slow down',
      aliases: ['slower', 'más lento', '放慢', '천천히'],
      action: 'adjustSpeed',
      parameters: { rate: 0.75 }
    },
    {
      command: 'louder',
      aliases: ['volume up', 'más alto', '大声点', '크게'],
      action: 'adjustVolume',
      parameters: { volume: 1.0 }
    },
    {
      command: 'quieter',
      aliases: ['volume down', 'más bajo', '小声点', '작게'],
      action: 'adjustVolume',
      parameters: { volume: 0.5 }
    },
    {
      command: 'submit application',
      aliases: ['send application', 'enviar solicitud', '提交申请', '신청서 제출'],
      action: 'submitForm',
      parameters: {}
    },
    {
      command: 'check status',
      aliases: ['application status', 'estado de solicitud', '检查状态', '상태 확인'],
      action: 'checkApplicationStatus',
      parameters: {}
    }
  ];

  /**
   * Get user's voice settings
   */
  async getUserVoiceSettings(userId: string): Promise<VoiceSettings> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user && user.preferences) {
        const prefs = user.preferences as any;
        return {
          enabled: prefs.voiceEnabled ?? this.defaultVoiceSettings.enabled,
          language: this.supportedLanguages[prefs.preferredLanguage as keyof typeof this.supportedLanguages] || 'en-US',
          voiceName: prefs.voiceName,
          rate: prefs.voiceSpeed ?? this.defaultVoiceSettings.rate,
          pitch: prefs.voicePitch ?? this.defaultVoiceSettings.pitch,
          volume: prefs.voiceVolume ?? this.defaultVoiceSettings.volume,
          autoSpeak: prefs.autoSpeak ?? this.defaultVoiceSettings.autoSpeak,
          enableSoundEffects: prefs.enableSoundEffects ?? this.defaultVoiceSettings.enableSoundEffects
        };
      }
    } catch (error) {
      console.error('Error fetching voice settings:', error);
    }

    return this.defaultVoiceSettings;
  }

  /**
   * Save user's voice settings
   */
  async saveUserVoiceSettings(userId: string, settings: Partial<VoiceSettings>): Promise<void> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        const currentPrefs = (user.preferences as any) || {};
        const updatedPrefs = {
          ...currentPrefs,
          voiceEnabled: settings.enabled ?? currentPrefs.voiceEnabled,
          voiceName: settings.voiceName ?? currentPrefs.voiceName,
          voiceSpeed: settings.rate ?? currentPrefs.voiceSpeed,
          voicePitch: settings.pitch ?? currentPrefs.voicePitch,
          voiceVolume: settings.volume ?? currentPrefs.voiceVolume,
          autoSpeak: settings.autoSpeak ?? currentPrefs.autoSpeak,
          enableSoundEffects: settings.enableSoundEffects ?? currentPrefs.enableSoundEffects
        };

        await db
          .update(users)
          .set({ preferences: updatedPrefs })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      console.error('Error saving voice settings:', error);
    }
  }

  /**
   * Get speech recognition configuration for a language
   */
  getSpeechRecognitionConfig(language: string): SpeechRecognitionConfig {
    return {
      language: this.supportedLanguages[language as keyof typeof this.supportedLanguages] || 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      profanityFilter: true
    };
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    transcript: string,
    sessionId: string,
    userId?: string
  ): Promise<{
    recognized: boolean;
    command?: VoiceCommand;
    response?: string;
    action?: any;
  }> {
    const normalizedTranscript = transcript.toLowerCase().trim();

    // Find matching command
    for (const command of this.voiceCommands) {
      const allTriggers = [command.command, ...command.aliases];
      
      for (const trigger of allTriggers) {
        if (normalizedTranscript.includes(trigger.toLowerCase())) {
          // Execute command action
          const result = await this.executeVoiceCommand(command, sessionId, userId);
          
          return {
            recognized: true,
            command,
            response: result.response,
            action: result.action
          };
        }
      }
    }

    return { recognized: false };
  }

  /**
   * Execute voice command action
   */
  private async executeVoiceCommand(
    command: VoiceCommand,
    sessionId: string,
    userId?: string
  ): Promise<{ response: string; action?: any }> {
    switch (command.action) {
      case 'showHelp':
        return {
          response: "I can help you apply for benefits, check your eligibility, upload documents, and answer questions about Maryland assistance programs. You can say things like 'I want to apply for food assistance' or 'What benefits am I eligible for?' How can I assist you today?",
          action: { type: 'showHelp' }
        };

      case 'restartSession':
        return {
          response: "I'll start over. Let's begin fresh. How can I help you today?",
          action: { type: 'restart' }
        };

      case 'repeatLastMessage':
        return {
          response: "I'll repeat what I just said.",
          action: { type: 'repeat' }
        };

      case 'stopSpeaking':
        return {
          response: "",
          action: { type: 'stopAudio' }
        };

      case 'adjustSpeed':
        if (userId) {
          await this.saveUserVoiceSettings(userId, { rate: command.parameters?.rate });
        }
        return {
          response: `I've adjusted my speaking speed to ${command.parameters?.rate > 1 ? 'faster' : 'slower'}.`,
          action: { type: 'adjustSpeed', rate: command.parameters?.rate }
        };

      case 'adjustVolume':
        if (userId) {
          await this.saveUserVoiceSettings(userId, { volume: command.parameters?.volume });
        }
        return {
          response: `Volume adjusted to ${command.parameters?.volume > 0.75 ? 'louder' : 'quieter'}.`,
          action: { type: 'adjustVolume', volume: command.parameters?.volume }
        };

      case 'submitForm':
        return {
          response: "I'll help you submit your application. Let me check if all required information is complete.",
          action: { type: 'submitApplication' }
        };

      case 'checkApplicationStatus':
        return {
          response: "I'll check your application status for you.",
          action: { type: 'checkStatus' }
        };

      default:
        return {
          response: "I understood your command but I'm not sure how to help with that. Could you try saying it differently?"
        };
    }
  }

  /**
   * Generate SSML for enhanced speech synthesis
   */
  generateSSML(
    text: string,
    options: {
      emphasis?: 'strong' | 'moderate' | 'reduced';
      rate?: number;
      pitch?: number;
      pauseAfter?: number;
      language?: string;
    } = {}
  ): string {
    const {
      emphasis = 'moderate',
      rate = 1.0,
      pitch = 1.0,
      pauseAfter = 0,
      language = 'en-US'
    } = options;

    let ssml = `<speak version="1.0" xml:lang="${language}">`;
    
    // Add prosody for rate and pitch control
    ssml += `<prosody rate="${rate}" pitch="${pitch > 1 ? '+' : ''}${(pitch - 1) * 100}%">`;
    
    // Add emphasis if needed
    if (emphasis !== 'moderate') {
      ssml += `<emphasis level="${emphasis}">`;
    }
    
    // Add the text
    ssml += this.escapeSSML(text);
    
    // Close emphasis tag
    if (emphasis !== 'moderate') {
      ssml += `</emphasis>`;
    }
    
    // Close prosody tag
    ssml += `</prosody>`;
    
    // Add pause after if specified
    if (pauseAfter > 0) {
      ssml += `<break time="${pauseAfter}ms"/>`;
    }
    
    ssml += `</speak>`;
    
    return ssml;
  }

  /**
   * Escape text for SSML
   */
  private escapeSSML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get available voices for a language
   */
  getVoiceOptions(language: string): {
    voiceId: string;
    name: string;
    gender: string;
    description: string;
  }[] {
    // These would be populated from the client-side Web Speech API
    // This is a placeholder structure for voice selection
    const voiceMap: Record<string, any[]> = {
      'en-US': [
        { voiceId: 'Google US English', name: 'Google US English', gender: 'female', description: 'Clear American English voice' },
        { voiceId: 'Google US English Male', name: 'Google US English Male', gender: 'male', description: 'Natural male voice' },
        { voiceId: 'Microsoft Zira', name: 'Microsoft Zira', gender: 'female', description: 'Microsoft female voice' },
        { voiceId: 'Microsoft David', name: 'Microsoft David', gender: 'male', description: 'Microsoft male voice' }
      ],
      'es-US': [
        { voiceId: 'Google español', name: 'Google español', gender: 'female', description: 'Spanish female voice' },
        { voiceId: 'Google español Male', name: 'Google español Male', gender: 'male', description: 'Spanish male voice' }
      ],
      'zh-CN': [
        { voiceId: 'Google 普通话', name: 'Google 普通话', gender: 'female', description: 'Mandarin Chinese voice' }
      ],
      'ko-KR': [
        { voiceId: 'Google 한국의', name: 'Google 한국의', gender: 'female', description: 'Korean voice' }
      ]
    };

    const langCode = this.supportedLanguages[language as keyof typeof this.supportedLanguages] || 'en-US';
    return voiceMap[langCode] || voiceMap['en-US'];
  }

  /**
   * Get accessibility settings for voice interaction
   */
  async getAccessibilitySettings(userId?: string): Promise<AccessibilitySettings> {
    const defaultSettings: AccessibilitySettings = {
      screenReaderMode: false,
      voiceGuidance: true,
      audioDescriptions: true,
      keyboardShortcuts: true,
      highContrastAudio: false
    };

    if (!userId) return defaultSettings;

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user && user.preferences) {
        const prefs = user.preferences as any;
        return {
          screenReaderMode: prefs.screenReaderMode ?? defaultSettings.screenReaderMode,
          voiceGuidance: prefs.voiceGuidance ?? defaultSettings.voiceGuidance,
          audioDescriptions: prefs.audioDescriptions ?? defaultSettings.audioDescriptions,
          keyboardShortcuts: prefs.keyboardShortcuts ?? defaultSettings.keyboardShortcuts,
          highContrastAudio: prefs.highContrastAudio ?? defaultSettings.highContrastAudio
        };
      }
    } catch (error) {
      console.error('Error fetching accessibility settings:', error);
    }

    return defaultSettings;
  }

  /**
   * Generate audio cues for UI interactions
   */
  getAudioCue(action: string): {
    sound?: string;
    description: string;
    vibrationPattern?: number[];
  } {
    const cues: Record<string, any> = {
      'messageReceived': {
        sound: 'notification',
        description: 'New message received',
        vibrationPattern: [100, 50, 100]
      },
      'messageSent': {
        sound: 'send',
        description: 'Message sent',
        vibrationPattern: [50]
      },
      'voiceStart': {
        sound: 'beep-up',
        description: 'Listening started',
        vibrationPattern: [100]
      },
      'voiceStop': {
        sound: 'beep-down',
        description: 'Listening stopped',
        vibrationPattern: [50, 50]
      },
      'error': {
        sound: 'error',
        description: 'Error occurred',
        vibrationPattern: [200, 100, 200]
      },
      'success': {
        sound: 'success',
        description: 'Action completed successfully',
        vibrationPattern: [50, 100, 50]
      },
      'formProgress': {
        sound: 'progress',
        description: 'Form progress updated',
        vibrationPattern: [25, 25]
      },
      'documentUploaded': {
        sound: 'upload',
        description: 'Document uploaded successfully',
        vibrationPattern: [100, 50, 50]
      }
    };

    return cues[action] || { description: 'Action completed' };
  }

  /**
   * Format text for optimal speech synthesis
   */
  formatForSpeech(text: string, language: string = 'en'): string {
    // Replace common abbreviations
    const abbreviations: Record<string, string> = {
      'SNAP': 'snap benefits',
      'TANF': 'tanf assistance',
      'MEDICAID': 'medicaid',
      'OHEP': 'energy assistance',
      'SSN': 'social security number',
      'DOB': 'date of birth',
      'ID': 'identification',
      'apt': 'apartment',
      'St': 'Street',
      'Ave': 'Avenue',
      'Rd': 'Road',
      'Blvd': 'Boulevard',
      '$': 'dollars',
      '%': 'percent',
      '#': 'number',
      '&': 'and'
    };

    let formattedText = text;

    // Replace abbreviations
    Object.entries(abbreviations).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      formattedText = formattedText.replace(regex, full);
    });

    // Format numbers for better pronunciation
    formattedText = formattedText.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'); // Phone numbers
    formattedText = formattedText.replace(/(\d{5})(\d{4})/, '$1-$2'); // ZIP+4
    
    // Add pauses after sentences
    formattedText = formattedText.replace(/\. /g, '. , ');
    
    // Format currency
    formattedText = formattedText.replace(/\$(\d+)\.(\d{2})/g, '$1 dollars and $2 cents');
    formattedText = formattedText.replace(/\$(\d+)/g, '$1 dollars');

    return formattedText;
  }

  /**
   * Get language-specific prompts for voice interaction
   */
  getVoicePrompts(language: string): Record<string, string> {
    const prompts: Record<string, Record<string, string>> = {
      'en': {
        'listening': "I'm listening. Please speak your message.",
        'processing': "Processing your request...",
        'notUnderstood': "I didn't catch that. Could you please repeat?",
        'speakSlower': "Please speak a bit slower.",
        'speakClearer': "Please speak more clearly.",
        'noMicrophone': "Microphone access is needed for voice input.",
        'microphoneError': "There was a problem with your microphone.",
        'commandRecognized': "Command recognized.",
        'voiceEnabled': "Voice assistance is now enabled.",
        'voiceDisabled': "Voice assistance is now disabled."
      },
      'es': {
        'listening': "Estoy escuchando. Por favor, hable su mensaje.",
        'processing': "Procesando su solicitud...",
        'notUnderstood': "No entendí eso. ¿Podría repetir por favor?",
        'speakSlower': "Por favor, hable un poco más despacio.",
        'speakClearer': "Por favor, hable más claramente.",
        'noMicrophone': "Se necesita acceso al micrófono para entrada de voz.",
        'microphoneError': "Hubo un problema con su micrófono.",
        'commandRecognized': "Comando reconocido.",
        'voiceEnabled': "La asistencia de voz está ahora habilitada.",
        'voiceDisabled': "La asistencia de voz está ahora deshabilitada."
      },
      'zh': {
        'listening': "我在听。请说出您的消息。",
        'processing': "正在处理您的请求...",
        'notUnderstood': "我没听清楚。您能再说一遍吗？",
        'speakSlower': "请说慢一点。",
        'speakClearer': "请说得更清楚些。",
        'noMicrophone': "语音输入需要麦克风权限。",
        'microphoneError': "您的麦克风出现问题。",
        'commandRecognized': "命令已识别。",
        'voiceEnabled': "语音助手已启用。",
        'voiceDisabled': "语音助手已禁用。"
      },
      'ko': {
        'listening': "듣고 있습니다. 메시지를 말씀해 주세요.",
        'processing': "요청을 처리 중입니다...",
        'notUnderstood': "잘 듣지 못했습니다. 다시 말씀해 주시겠습니까?",
        'speakSlower': "조금 더 천천히 말씀해 주세요.",
        'speakClearer': "더 명확하게 말씀해 주세요.",
        'noMicrophone': "음성 입력을 위해 마이크 접근이 필요합니다.",
        'microphoneError': "마이크에 문제가 발생했습니다.",
        'commandRecognized': "명령이 인식되었습니다.",
        'voiceEnabled': "음성 지원이 활성화되었습니다.",
        'voiceDisabled': "음성 지원이 비활성화되었습니다."
      }
    };

    return prompts[language] || prompts['en'];
  }
}

export const voiceAssistantService = new VoiceAssistantService();