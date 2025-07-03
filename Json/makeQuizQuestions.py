import json
import os
import random
import re
import unicodedata

# Function to remove accents for copy_word question
def remove_accents(text):
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text.lower().replace(' ', '')

# Function to map part_of_speech to Vietnamese
def get_part_of_speech_vn(pos):
    pos_map = {
        'v': 'động từ',
        'n': 'danh từ',
        'adj': 'tính từ',
        'adv': 'trạng từ'
    }
    return pos_map.get(pos, 'khác')

# Function to generate distractors for multiple_choice questions
def generate_distractors(correct_answer, all_entries, field, num_options=4, exclude_word=None):
    options = [correct_answer]
    candidates = [entry[field] for entry in all_entries if entry[field] != correct_answer and entry['word'] != exclude_word]
    if len(candidates) < num_options - 1:
        print(f"Warning: Not enough unique {field} values for distractors. Using available ones.")
        random.shuffle(candidates)
        options.extend(candidates[:num_options - 1])
    else:
        options.extend(random.sample(candidates, num_options - 1))
    random.shuffle(options)
    return options

# Function to jumble words for word_order question
def jumble_sentence(sentence):
    words = sentence.split()
    random.shuffle(words)
    return ' '.join(words)

# Function to generate quiz questions
def generate_quiz_questions(input_file, output_file):
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        return
    
    try:
        # Read the JSON input file
        with open(input_file, 'r', encoding='utf-8') as file:
            entries = json.load(file)
        
        if not entries:
            print(f"Warning: Input file '{input_file}' is empty.")
            return
        
        quiz_questions = []
        
        # Generate questions for each entry
        for entry in entries:
            word = entry.get('word', '')
            vi = entry.get('vi', '')
            en = entry.get('en', '')
            example = entry.get('example', '')
            example_vi = entry.get('example_vi', '')
            phonics = entry.get('phonics', '')
            part_of_speech = entry.get('part_of_speech', '')
            
            if not word or not vi or not example or not example_vi:
                print(f"Skipping entry for word '{word}' due to missing fields.")
                continue
            
            # 1. translate_sentence_en_to_vn
            if example and example_vi:
                options = generate_distractors(example_vi, entries, 'example_vi', exclude_word=word)
                if len(options) >= 4:
                    quiz_questions.append({
                        'type': 'translate_sentence_en_to_vn',
                        'question_template': 'Dịch câu sau sang tiếng Việt: "{english_sentence}"',
                        'english_sentence': example,
                        'correct_answer_text': example_vi,
                        'options': options
                    })
            
            # 2. multiple_choice_meaning_vn
            options = generate_distractors(vi, entries, 'vi', exclude_word=word)
            if len(options) >= 4:
                quiz_questions.append({
                    'type': 'multiple_choice_meaning_vn',
                    'question_template': "What is the Vietnamese meaning of the word '{word}'?",
                    'answer_source_field': 'vi',
                    'correct_answer_text': vi,
                    'options': options
                })
            
            # 3. copy_word
            no_accent_word = remove_accents(word)
            quiz_questions.append({
                'type': 'copy_word',
                'question_template': "Please copy the word '{word}' 3 times (no accents, no spaces):",
                'answer_source_field': 'word',
                'correct_answer_text': no_accent_word * 3
            })
            
            # 4. part_of_speech_vn
            part_of_speech_vn = get_part_of_speech_vn(part_of_speech)
            pos_options = ['động từ', 'danh từ', 'tính từ', 'trạng từ']
            if part_of_speech_vn not in pos_options:
                pos_options.append(part_of_speech_vn)
            pos_options = random.sample(pos_options, min(4, len(pos_options)))
            if part_of_speech_vn not in pos_options:
                pos_options[-1] = part_of_speech_vn
            random.shuffle(pos_options)
            quiz_questions.append({
                'type': 'part_of_speech_vn',
                'question_template': "What is the Vietnamese part of speech for '{word}'?",
                'answer_source_field': 'part_of_speech_vn',
                'correct_answer_text': part_of_speech_vn,
                'options': pos_options
            })
            
            # 5. phonics_matching
            if phonics:
                phonics_options = generate_distractors(phonics, entries, 'phonics', exclude_word=word)
                if len(phonics_options) >= 4:
                    quiz_questions.append({
                        'type': 'phonics_matching',
                        'question_template': "What is the phonetic transcription of the word '{word}'?",
                        'answer_source_field': 'phonics',
                        'correct_answer_text': phonics,
                        'options': phonics_options
                    })
            
            # 6. fill_in_the_blank
            if word.lower() in example.lower():
                blanked_example = re.sub(r'\b' + re.escape(word) + r'\b', '_____', example, flags=re.IGNORECASE)
                word_options = generate_distractors(word, entries, 'word', exclude_word=word)
                if len(word_options) >= 4:
                    quiz_questions.append({
                        'type': 'fill_in_the_blank',
                        'question_template': 'Fill in the blank: "{sentence}"',
                        'sentence': blanked_example,
                        'correct_answer_text': word,
                        'options': word_options
                    })
            
            # 7. word_order
            if example_vi:
                jumbled = jumble_sentence(example_vi)
                quiz_questions.append({
                    'type': 'word_order',
                    'question_template': 'Arrange the following words into a correct Vietnamese sentence: "{jumbled_sentence}"',
                    'jumbled_sentence': jumbled,
                    'correct_answer_text': example_vi
                })
        
        print(f"Generated {len(quiz_questions)} quiz questions from {len(entries)} entries.")
        
        # Write to JSON output file
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(quiz_questions, file, ensure_ascii=False, indent=4)
        print(f"Quiz questions written to '{output_file}'.")
    
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in '{input_file}': {e}")
    except Exception as e:
        print(f"Error processing file: {e}")

# Execute the function
if __name__ == "__main__":
    input_file = "D:\\nodejs\\txt\\output111.json"
    output_file = "D:\\nodejs\\txt\\quiz_questions.json"
    generate_quiz_questions(input_file, output_file)