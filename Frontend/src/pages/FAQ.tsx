import { motion } from 'framer-motion';
import { HelpCircle, Search } from 'lucide-react';
import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { mockFAQItems, getAllFAQCategories } from '@/mock/market';
import { cn } from '@/lib/utils';

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = getAllFAQCategories();

  const filteredFAQs = mockFAQItems.filter((faq) => {
    const matchesSearch = searchQuery
      ? faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesCategory = activeCategory ? faq.category === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="w-6 h-6" />
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground">Find answers to common questions</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search questions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveCategory(null)} className={cn('px-3 py-1.5 rounded-lg text-sm transition-colors', !activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={cn('px-3 py-1.5 rounded-lg text-sm transition-colors', activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80')}>{cat}</button>
          ))}
        </div>
      </div>

      <Card variant="glass">
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="space-y-2">
            {filteredFAQs.map((faq, index) => (
              <motion.div key={faq.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                <AccordionItem value={faq.id} className="border border-border/50 rounded-xl px-4 bg-muted/20">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-medium">{faq.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
