import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  Loader2,
  HelpCircle,
  Briefcase,
  Calendar,
  FileText,
  DollarSign,
  Users,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  category?: string;
}

interface QuickQuestion {
  id: string;
  text: string;
  category: string;
  icon: typeof HelpCircle;
}

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'work-req',
    text: "What are the work requirements for SNAP?",
    category: 'abawd',
    icon: Briefcase,
  },
  {
    id: 'check-status',
    text: "How do I check my benefit status?",
    category: 'status',
    icon: DollarSign,
  },
  {
    id: 'docs-needed',
    text: "What documents do I need to submit?",
    category: 'documents',
    icon: FileText,
  },
  {
    id: 'renewal-deadline',
    text: "When is my renewal deadline?",
    category: 'redetermination',
    icon: Calendar,
  },
  {
    id: 'household-change',
    text: "How do I report household changes?",
    category: 'household',
    icon: Users,
  },
];

const FAQ_RESPONSES: Record<string, string> = {
  work_requirements: `**SNAP Work Requirements (ABAWD)**

If you're an able-bodied adult without dependents (ABAWD) between 18-49 years old, you may need to meet work requirements:

**What You Need to Do:**
- Work at least 80 hours per month, OR
- Participate in approved job training/education, OR  
- Volunteer at least 80 hours per month

**Time Limits:**
- You can receive SNAP for up to 3 months in a 3-year period without meeting work requirements
- After 3 months, you must work or participate in approved activities

**Exemptions:**
You may be exempt if you:
- Are pregnant
- Care for a child under 6 or an incapacitated person
- Have a disability (physical or mental)
- Are in a drug/alcohol treatment program
- Work 30+ hours per week already

**Need Help?** Call 1-800-332-6347 to discuss your situation.`,

  benefit_status: `**Checking Your Benefit Status**

There are several ways to check your SNAP benefit status:

**Online:**
1. Visit your state's benefits portal
2. Log in with your account credentials
3. View your current benefit amount and EBT balance

**By Phone:**
- Maryland: 1-800-332-6347
- Have your case number ready

**EBT Card Balance:**
- Call the number on the back of your EBT card
- Check at participating ATMs
- Use the EBT mobile app

**What You'll See:**
- Current monthly benefit amount
- Next issuance date
- Certification end date
- Required actions (if any)

**Tip:** Set up email or text alerts for important updates about your case.`,

  documents_needed: `**Documents You May Need to Submit**

**Identity Verification:**
- Driver's license or state ID
- Birth certificate
- Passport
- School ID with photo

**Income Verification:**
- Last 4 pay stubs
- Self-employment records
- Social Security award letter
- Unemployment benefits letter
- Child support documentation

**Housing Costs:**
- Lease or rental agreement
- Mortgage statement
- Recent utility bills (electric, gas, water)
- Property tax statement

**Other Documents:**
- Bank statements (last 2 months)
- Medical expense receipts (if 60+ or disabled)
- Child care receipts
- Immigration documents (if applicable)

**How to Submit:**
1. Online: Upload through your state portal
2. In Person: Bring to your local DSS office
3. Mail: Send copies (not originals) to your local office
4. Fax: Check with your local office for fax number

**Keep Copies:** Always keep copies of everything you submit!`,

  renewal_deadline: `**SNAP Renewal (Recertification)**

Your SNAP benefits must be renewed periodically to continue receiving assistance.

**When to Renew:**
- Most households: Every 12 months
- Some households: Every 6 months
- Check your certification end date on your benefit notice

**Renewal Process:**
1. You'll receive a renewal packet 30-45 days before your deadline
2. Complete and return the renewal form
3. Attend interview (phone or in-person)
4. Provide any requested documents
5. Wait for determination notice

**Important Deadlines:**
- Return forms by the date shown on the packet
- Missing the deadline may cause a gap in benefits
- If you miss your deadline, reapply as soon as possible

**What to Include:**
- Updated income information
- Household changes (new members, moves)
- Changes in expenses
- Current asset information

**Reminder:** Set a calendar reminder 30 days before your certification ends!`,

  household_changes: `**Reporting Household Changes**

You're required to report changes within 10 days of when they occur.

**Changes You Must Report:**

**Income Changes:**
- New job or lost job
- Change in hours or pay rate
- New or ended self-employment
- Changes in benefits (SSI, SSDI, unemployment)

**Household Changes:**
- Someone moves in or out
- Birth of a child
- Marriage or divorce
- Death of a household member

**Other Changes:**
- Address change
- Change in shelter costs
- Change in work status

**How to Report:**
1. **Online:** Log into your benefits portal and submit a change
2. **Phone:** Call 1-800-332-6347
3. **In Person:** Visit your local DSS office
4. **Mail/Fax:** Send written notice to your local office

**Important:** Failure to report changes can result in overpayment that must be repaid, or even disqualification from the program.

**Tip:** Keep records of when and how you reported changes.`,

  general_help: `**How Can I Help You?**

I'm here to help you with questions about your SNAP benefits. Here are some topics I can assist with:

**Common Questions:**
- Work requirements and exemptions
- Benefit amounts and EBT balance
- Documents needed for your case
- Renewal deadlines and process
- Reporting changes to your household

**Helpful Resources:**
- Call Center: 1-800-332-6347 (Mon-Fri, 8am-5pm)
- Local DSS Office: Find your office at [link]
- Online Portal: Apply and manage your case online

**For Urgent Matters:**
If you have an emergency and need food assistance immediately, please call your local DSS office or visit in person.

**What would you like to know more about?** You can ask me a question or choose from the quick topics below.`
};

export default function ClientFAQChatbot({ 
  isEmbedded = false,
  onClose 
}: { 
  isEmbedded?: boolean;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: FAQ_RESPONSES.general_help,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest('/api/client/faq-chat', {
        method: 'POST',
        body: JSON.stringify({ question }),
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.answer || data.response || FAQ_RESPONSES.general_help,
        timestamp: new Date(),
        category: data.category,
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble processing your question. Please try again or contact 1-800-332-6347 for immediate assistance.",
        timestamp: new Date(),
      }]);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(input);
    setInput('');
  };

  const handleQuickQuestion = (question: QuickQuestion) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question.text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    let responseKey = 'general_help';
    switch (question.category) {
      case 'abawd': responseKey = 'work_requirements'; break;
      case 'status': responseKey = 'benefit_status'; break;
      case 'documents': responseKey = 'documents_needed'; break;
      case 'redetermination': responseKey = 'renewal_deadline'; break;
      case 'household': responseKey = 'household_changes'; break;
    }

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: FAQ_RESPONSES[responseKey],
        timestamp: new Date(),
        category: question.category,
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const cardClass = isEmbedded 
    ? "h-full flex flex-col" 
    : isExpanded 
      ? "fixed inset-4 z-50 flex flex-col"
      : "h-[500px] flex flex-col";

  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Benefits Assistant</CardTitle>
              <CardDescription>Get answers about SNAP benefits</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isEmbedded && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-4">
        {/* Messages Area */}
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                    {message.content.split('**').map((part, i) => 
                      i % 2 === 0 ? part : <strong key={i}>{part}</strong>
                    )}
                  </div>
                  {message.category && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {message.category}
                    </Badge>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="flex-shrink-0 mt-4 border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q.id}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleQuickQuestion(q)}
                >
                  <q.icon className="h-3 w-3 mr-1" />
                  {q.text}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 flex gap-2 mt-4 pt-4 border-t">
          <Input
            placeholder="Ask a question about your benefits..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || chatMutation.isPending}
            size="icon"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[500px] z-50 shadow-xl">
          <ClientFAQChatbot onClose={() => setIsOpen(false)} />
        </div>
      )}
      <Button
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
