import nltk
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.summarizers.luhn import LuhnSummarizer
from sumy.summarizers.text_rank import TextRankSummarizer
import warnings
warnings.filterwarnings('ignore')


class TextSummarizer:

    def __init__(self):
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt', quiet=True)
            nltk.download('punkt_tab', quiet=True)

        self.abstractive_summarizer = None
        self.tokenizer = None
        self.model = None

    def extractive_summarize_lsa(self, text, num_sentences=3):
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LsaSummarizer()
        summary = summarizer(parser.document, num_sentences)
        return ' '.join([str(sentence) for sentence in summary])

    def extractive_summarize_textrank(self, text, num_sentences=3):
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = TextRankSummarizer()
        summary = summarizer(parser.document, num_sentences)
        return ' '.join([str(sentence) for sentence in summary])

    def extractive_summarize_luhn(self, text, num_sentences=3):
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LuhnSummarizer()
        summary = summarizer(parser.document, num_sentences)
        return ' '.join([str(sentence) for sentence in summary])

    def abstractive_summarize(self, text, max_length=130, min_length=30):
        if self.abstractive_summarizer is None:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

            model_name = "facebook/bart-large-cnn"
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            self.abstractive_summarizer = "loaded"

        max_input_length = 1024
        if len(text.split()) > max_input_length:
            text = ' '.join(text.split()[:max_input_length])

        inputs = self.tokenizer([text], max_length=1024, truncation=True, return_tensors="pt")

        summary_ids = self.model.generate(
            inputs["input_ids"],
            max_length=max_length,
            min_length=min_length,
            num_beams=4,
            length_penalty=2.0,
            early_stopping=True
        )

        summary = self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
