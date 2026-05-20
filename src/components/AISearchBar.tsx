import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { getAutocompleteSuggestions } from '@/lib/collaborativeAI';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const AISearchBar = ({ value, onChange }: Props) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }
      
      try {
        const data = await getAutocompleteSuggestions(value);
        setSuggestions(data || []);
      } catch (error) {
        console.error("Failed to load autocomplete suggestions", error);
      }
    };

    // DEBOUNCE: Wait 300ms after the user stops typing to fire the API call
    const delayDebounceFn = setTimeout(() => {
      loadSuggestions();
    }, 300);

    // Cleanup the timeout if the user types again before 300ms is up
    return () => clearTimeout(delayDebounceFn);
  }, [value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false); // Hide dropdown when a suggestion is clicked
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true); // Open dropdown when typing
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Delay blur so click registers
          placeholder="Search with AI..."
          className="pl-10"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 shadow-xl border-slate-200">
          <CardContent className="p-1 max-h-64 overflow-y-auto space-y-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AISearchBar;