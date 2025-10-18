import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, ThumbsUp, ThumbsDown, MessageSquarePlus } from "lucide-react";
import { FeedbackSubmitDialog } from "@/components/feedback/FeedbackSubmitDialog";
import { Helmet } from "react-helmet-async";

interface FaqArticle {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
}

export default function FAQPublicView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const queryClient = useQueryClient();

  const { data: articles, isLoading } = useQuery<FaqArticle[]>({
    queryKey: ["/api/faq/articles"],
  });

  const helpfulMutation = useMutation({
    mutationFn: async ({ articleId, isHelpful }: { articleId: string; isHelpful: boolean }) => {
      return await apiRequest(`/api/faq/articles/${articleId}/helpful`, {
        method: "POST",
        body: JSON.stringify({ isHelpful }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faq/articles"] });
    },
  });

  const filteredArticles = articles?.filter((article) => {
    const matchesSearch = !searchQuery || 
      article.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
    
    return matchesSearch && matchesCategory && article.isPublished;
  }) || [];

  const categories = Array.from(new Set(articles?.map(a => a.category).filter(Boolean))) as string[];

  return (
    <>
      <Helmet>
        <title>Frequently Asked Questions - Maryland Benefits Platform</title>
        <meta name="description" content="Find answers to common questions about benefits, tax assistance, document requirements, and more on the Maryland Benefits Platform." />
        <meta property="og:title" content="FAQ - Maryland Benefits Platform" />
        <meta property="og:description" content="Get help with benefits eligibility, tax calculations, and platform features." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-6" data-testid="page-faq-public">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">
            Find answers to common questions about our platform
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search for questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-faq"
                />
              </div>
              <FeedbackSubmitDialog
                trigger={
                  <Button variant="outline" data-testid="button-submit-question">
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Ask a Question
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} data-testid="tabs-category">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} data-testid={`tab-${category}`}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  Loading FAQs...
                </CardContent>
              </Card>
            ) : filteredArticles.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <p>No FAQs found matching your search.</p>
                  <p className="mt-2">Try searching with different keywords or browse all categories.</p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-4" data-testid="accordion-faq">
                {filteredArticles.map((article) => (
                  <AccordionItem
                    key={article.id}
                    value={article.id}
                    className="border rounded-lg px-6"
                    data-testid={`accordion-item-${article.id}`}
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-start gap-3 text-left">
                        <span className="font-semibold">{article.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-muted-foreground whitespace-pre-wrap" data-testid={`text-answer-${article.id}`}>
                        {article.answer}
                      </p>

                      <div className="flex items-center gap-4 pt-4 border-t">
                        <span className="text-sm text-muted-foreground">Was this helpful?</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => helpfulMutation.mutate({ articleId: article.id, isHelpful: true })}
                          disabled={helpfulMutation.isPending}
                          data-testid={`button-helpful-${article.id}`}
                        >
                          <ThumbsUp className="mr-2 h-4 w-4" />
                          Yes ({article.helpfulCount})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => helpfulMutation.mutate({ articleId: article.id, isHelpful: false })}
                          disabled={helpfulMutation.isPending}
                          data-testid={`button-not-helpful-${article.id}`}
                        >
                          <ThumbsDown className="mr-2 h-4 w-4" />
                          No ({article.notHelpfulCount})
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        </Tabs>

        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Still have questions?</CardTitle>
            <CardDescription>
              Can't find what you're looking for? Submit your question and we'll get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedbackSubmitDialog
              trigger={
                <Button data-testid="button-submit-new-question">
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Submit Your Question
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
