import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Globe,
  Volume2,
  VolumeX,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronRight,
  User,
  Bot,
  Settings,
  History,
  Languages,
  FileText,
  Image,
  X,
  Loader2,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  language?: string;
  isVoiceInput?: boolean;
  attachments?: Attachment[];
  suggestedActions?: string[];
  formData?: Record<string, any>;
}

interface Attachment {
  id: string;
  filename: string;
  type: string;
  size: number;
  url?: string;
}

interface VoiceSettings {
  enabled: boolean;
  rate: number;
  pitch: number;
  volume: number;
  voice?: string;
  autoSpeak: boolean;
}

interface ChatSession {
  sessionId: string;
  language: string;
  formProgress: {
    completionPercentage: number;
    completedFields: Record<string, any>;
    validationErrors: Record<string, string>;
  };
  extractedData: Record<string, any>;
}

export function AIIntakeChat() {
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: false,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoSpeak: false
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  
  // Helper to get CSRF token
  const getCsrfToken = async (): Promise<string> => {
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    return data.token;
  };
  
  // Speech recognition and synthesis refs
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Initialize session
  const initSessionMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await fetch('/api/ai-intake/session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': await getCsrfToken()
        },
        credentials: 'include',
        body: JSON.stringify({ language })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setSession(data);
      // Add welcome message
      const welcomeMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: getWelcomeMessage(selectedLanguage),
        timestamp: new Date(),
        suggestedActions: ['Apply for benefits', 'Check eligibility', 'Upload documents', 'Get help']
      };
      setMessages([welcomeMessage]);
      if (voiceSettings.autoSpeak && voiceSettings.enabled) {
        speakMessage(welcomeMessage.content);
      }
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, isVoice, attachmentUrls }: {
      message: string;
      isVoice: boolean;
      attachmentUrls?: string[];
    }) => {
      if (!session) throw new Error('No active session');
      
      const response = await fetch('/api/ai-intake/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': await getCsrfToken()
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: session.sessionId,
          message,
          isVoiceInput: isVoice,
          attachments: attachmentUrls
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return response.json();
    },
    onMutate: ({ message, isVoice }) => {
      // Add user message immediately
      const userMessage: Message = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        isVoiceInput: isVoice,
        attachments: [...attachments]
      };
      setMessages(prev => [...prev, userMessage]);
      setAttachments([]); // Clear attachments after sending
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Add assistant response
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        intent: data.intent?.intent,
        suggestedActions: data.suggestedActions,
        formData: data.formUpdate
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update session with form progress
      if (data.formUpdate && session) {
        setSession({
          ...session,
          formProgress: {
            ...session.formProgress,
            ...data.formUpdate
          }
        });
      }
      
      // Speak response if enabled
      if (data.shouldSpeak && voiceSettings.enabled && voiceSettings.autoSpeak) {
        speakMessage(data.response);
      }
      
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send message. Please try again.'
      });
    }
  });

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = getLanguageCode(selectedLanguage);
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        if (event.results[0].isFinal) {
          handleVoiceInput(transcript);
          setIsListening(false);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          variant: 'destructive',
          title: 'Voice Input Error',
          description: 'Could not process voice input. Please try again.'
        });
      };
    }
  }, [selectedLanguage]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Initialize session on mount
  useEffect(() => {
    initSessionMutation.mutate(selectedLanguage);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice input handling
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.lang = getLanguageCode(selectedLanguage);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleVoiceInput = (transcript: string) => {
    setInputValue(transcript);
    // Auto-send after voice input
    if (transcript.trim()) {
      sendMessageMutation.mutate({
        message: transcript,
        isVoice: true
      });
      setInputValue('');
    }
  };

  // Text-to-speech
  const speakMessage = (text: string) => {
    if (!voiceSettings.enabled || isSpeaking) return;
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageCode(selectedLanguage);
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;
    
    // Set voice if selected
    if (voiceSettings.voice && voices.length > 0) {
      const selectedVoice = voices.find(v => v.name === voiceSettings.voice);
      if (selectedVoice) utterance.voice = selectedVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Send message
  const handleSendMessage = () => {
    if (inputValue.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({
        message: inputValue,
        isVoice: false,
        attachmentUrls: attachments.map(a => a.url || '')
      });
      setInputValue('');
    }
  };

  // File upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const attachment: Attachment = {
        id: `file_${Date.now()}_${Math.random()}`,
        filename: file.name,
        type: file.type,
        size: file.size
      };
      
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      
      apiRequest('/api/ai-intake/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set content-type for FormData
      }).then(data => {
        attachment.url = data.url;
        setAttachments(prev => [...prev, attachment]);
        toast({
          title: 'File uploaded',
          description: `${file.name} uploaded successfully`
        });
      }).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: `Could not upload ${file.name}`
        });
      });
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Quick action handler
  const handleQuickAction = (action: string) => {
    setInputValue(action);
    handleSendMessage();
  };

  // Language helpers
  const getLanguageCode = (lang: string): string => {
    const codes: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-US',
      'zh': 'zh-CN',
      'ko': 'ko-KR'
    };
    return codes[lang] || 'en-US';
  };

  const getLanguageName = (lang: string): string => {
    const names: Record<string, string> = {
      'en': 'English',
      'es': 'Español',
      'zh': '中文',
      'ko': '한국어'
    };
    return names[lang] || 'English';
  };

  const getWelcomeMessage = (lang: string): string => {
    const messages: Record<string, string> = {
      'en': "Hello! I'm here to help you apply for Maryland benefits. I can assist you with SNAP, Medicaid, TANF, and energy assistance programs. How can I help you today?",
      'es': "¡Hola! Estoy aquí para ayudarle a solicitar beneficios de Maryland. Puedo ayudarle con los programas SNAP, Medicaid, TANF y asistencia energética. ¿Cómo puedo ayudarle hoy?",
      'zh': "您好！我在这里帮助您申请马里兰州福利。我可以协助您申请SNAP、Medicaid、TANF和能源援助计划。今天我能为您做些什么？",
      'ko': "안녕하세요! 메릴랜드 복지 혜택 신청을 도와드리겠습니다. SNAP, Medicaid, TANF 및 에너지 지원 프로그램을 도와드릴 수 있습니다. 오늘 무엇을 도와드릴까요?"
    };
    return messages[lang] || messages['en'];
  };

  // Filter messages based on search
  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.intent?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto">
      <Card className="flex-1 flex flex-col">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Benefits Assistant
              </CardTitle>
              {session && (
                <Badge variant="outline">
                  Session: {session.sessionId.slice(0, 8)}...
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Language Selector */}
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-32">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Voice Toggle */}
              <Button
                variant={voiceSettings.enabled ? "default" : "outline"}
                size="icon"
                onClick={() => setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                data-testid="button-voice-toggle"
              >
                {voiceSettings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              
              {/* Settings */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-settings">
                    <Settings className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Chat Settings</SheetTitle>
                  </SheetHeader>
                  
                  <div className="space-y-6 mt-6">
                    {/* Voice Settings */}
                    <div className="space-y-4">
                      <h3 className="font-medium">Voice Settings</h3>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="auto-speak">Auto-speak responses</Label>
                          <Switch
                            id="auto-speak"
                            checked={voiceSettings.autoSpeak}
                            onCheckedChange={(checked) => 
                              setVoiceSettings(prev => ({ ...prev, autoSpeak: checked }))}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Speech Rate: {voiceSettings.rate.toFixed(1)}x</Label>
                        <Slider
                          value={[voiceSettings.rate]}
                          onValueChange={([value]) => 
                            setVoiceSettings(prev => ({ ...prev, rate: value }))}
                          min={0.5}
                          max={2}
                          step={0.1}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Pitch: {voiceSettings.pitch.toFixed(1)}</Label>
                        <Slider
                          value={[voiceSettings.pitch]}
                          onValueChange={([value]) => 
                            setVoiceSettings(prev => ({ ...prev, pitch: value }))}
                          min={0.5}
                          max={2}
                          step={0.1}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Volume: {Math.round(voiceSettings.volume * 100)}%</Label>
                        <Slider
                          value={[voiceSettings.volume]}
                          onValueChange={([value]) => 
                            setVoiceSettings(prev => ({ ...prev, volume: value }))}
                          min={0}
                          max={1}
                          step={0.1}
                        />
                      </div>
                      
                      {voices.length > 0 && (
                        <div className="space-y-2">
                          <Label>Voice</Label>
                          <Select 
                            value={voiceSettings.voice} 
                            onValueChange={(value) => 
                              setVoiceSettings(prev => ({ ...prev, voice: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {voices
                                .filter(v => v.lang.startsWith(getLanguageCode(selectedLanguage).split('-')[0]))
                                .map(voice => (
                                  <SelectItem key={voice.name} value={voice.name}>
                                    {voice.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    {/* Display Settings */}
                    <div className="space-y-4">
                      <h3 className="font-medium">Display</h3>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-translation">Show translations</Label>
                        <Switch
                          id="show-translation"
                          checked={showTranslation}
                          onCheckedChange={setShowTranslation}
                        />
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* History */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-history">
                    <History className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Conversation History</SheetTitle>
                  </SheetHeader>
                  
                  <div className="mt-4 space-y-4">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                        data-testid="input-search-history"
                      />
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        const text = messages.map(m => 
                          `[${m.role}]: ${m.content}`
                        ).join('\n\n');
                        
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'conversation-history.txt';
                        a.click();
                      }}
                      data-testid="button-download-history"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Transcript
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Form Progress */}
          {session && session.formProgress.completionPercentage > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Application Progress</span>
                <span className="font-medium">
                  {session.formProgress.completionPercentage}% Complete
                </span>
              </div>
              <Progress value={session.formProgress.completionPercentage} />
              {Object.keys(session.formProgress.validationErrors).length > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {Object.keys(session.formProgress.validationErrors).length} validation errors
                </div>
              )}
            </div>
          )}
        </CardHeader>
        
        {/* Messages Area */}
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            <AnimatePresence>
              {filteredMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`mb-4 flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex max-w-[75%] items-start space-x-2 ${
                      message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="space-y-2">
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        
                        {message.isVoiceInput && (
                          <Badge variant="secondary" className="mt-2">
                            <Mic className="w-3 h-3 mr-1" />
                            Voice Input
                          </Badge>
                        )}
                        
                        {message.intent && (
                          <Badge variant="outline" className="mt-2">
                            Intent: {message.intent}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.attachments.map(attachment => (
                            <Badge key={attachment.id} variant="secondary" className="flex items-center gap-1">
                              {attachment.type.startsWith('image/') ? (
                                <Image className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              {attachment.filename}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* Suggested Actions */}
                      {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {message.suggestedActions.map((action, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={() => handleQuickAction(action)}
                              className="text-xs"
                              data-testid={`button-action-${idx}`}
                            >
                              {action}
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-2 text-muted-foreground"
              >
                <Bot className="w-4 h-4" />
                <div className="flex space-x-1">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-muted-foreground rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                    className="w-2 h-2 bg-muted-foreground rounded-full"
                  />
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-muted-foreground rounded-full"
                  />
                </div>
              </motion.div>
            )}
            
            <div ref={chatEndRef} />
          </ScrollArea>
        </CardContent>
        
        {/* Input Area */}
        <div className="border-t p-4 space-y-2">
          {/* File Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(attachment => (
                <Badge key={attachment.id} variant="secondary" className="flex items-center gap-1">
                  {attachment.type.startsWith('image/') ? (
                    <Image className="w-3 h-3" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  {attachment.filename}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== attachment.id))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMessageMutation.isPending}
              data-testid="button-attach"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={`Type your message in ${getLanguageName(selectedLanguage)}...`}
              disabled={sendMessageMutation.isPending || isListening}
              className="flex-1"
              data-testid="input-message"
            />
            
            {voiceSettings.enabled && (
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={isListening ? stopListening : startListening}
                disabled={sendMessageMutation.isPending}
                data-testid="button-voice-input"
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 animate-pulse" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}
            
            {isSpeaking && (
              <Button
                variant="outline"
                size="icon"
                onClick={stopSpeaking}
                data-testid="button-stop-speaking"
              >
                <VolumeX className="w-4 h-4" />
              </Button>
            )}
            
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sendMessageMutation.isPending}
              data-testid="button-send"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {/* Help Text */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>
                Type your question or use voice input. I can help with SNAP, Medicaid, TANF, and energy assistance.
              </span>
            </div>
            {isListening && (
              <Badge variant="destructive" className="animate-pulse">
                <Mic className="w-3 h-3 mr-1" />
                Listening...
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}