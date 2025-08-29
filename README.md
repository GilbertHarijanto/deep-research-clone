# Deep Research Clone - Streamlit App

A powerful AI-powered research assistant built with Streamlit and OpenAI's API. This application conducts comprehensive research on any topic by asking clarifying questions, performing web searches, and generating detailed reports.

🚀 **[Try the live demo here!](https://deep-research-gilbert.streamlit.app/)**

## Features

- **Interactive Research Flow**: Guides users through a structured research process
- **Flexible API Key Setup**: Enter API key directly in the app or use environment variables
- **Clarifying Questions**: AI generates relevant questions to understand research intent
- **Comprehensive Web Search**: Performs multiple targeted web searches
- **Iterative Research**: Continues searching until sufficient information is gathered
- **Detailed Reports**: Generates comprehensive research reports with citations
- **Modern UI**: Clean and intuitive Streamlit interface
- **Session Persistence**: API key and research progress saved during your session

## Setup Instructions

### 1. Virtual Environment Setup

The virtual environment has already been created. To activate it:

```bash
# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. API Key Setup

You have two options for setting up your OpenAI API key:

**Option 1: Environment Variable (Recommended for local development)**
1. Copy `env_example.txt` to `.env`:
   ```bash
   cp env_example.txt .env
   ```
2. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

**Option 2: Direct Input (Great for deployed apps)**
- The app will automatically show an API key input box
- Enter your key directly in the web interface
- Your key is stored securely in the session

Get your API key from: https://platform.openai.com/api-keys

### 4. Run the Application

```bash
streamlit run app.py
```

The app will open in your browser at `http://localhost:8501`

## Project Structure

```
Deep Research Clone/
├── app.py               # Main Streamlit application
├── requirements.txt     # Python dependencies
├── .gitignore          # Git ignore rules
├── .env                # Environment variables (create from env_example.txt)
├── env_example.txt     # Environment template
├── venv/               # Virtual environment
└── README.md           # This file
```

## How It Works

1. **Topic Input**: Enter your research topic
2. **Clarifying Questions**: AI asks 5 questions to understand your research intent
3. **Research Planning**: AI generates a research goal and initial search queries
4. **Web Research**: Performs comprehensive web searches with iterative improvement
5. **Report Generation**: Creates a detailed research report with citations

## Usage Tips

- Be specific with your research topic for better results
- Answer clarifying questions thoroughly for more targeted research
- The research process may take several minutes depending on the topic complexity
- Download your research reports for future reference

## Example Usage

Here's an example of how to provide detailed answers to clarifying questions:

### Clarifying Questions Answered for Research on *Vibe Coding*

**1. What specific aspects of vibe coding are you interested in exploring?**  
I am interested in understanding what vibe coding actually is in terms of definitions and theories, its applications across creative and technical domains, and concrete ways to start practicing or experimenting with it.  

**2. Are you looking to understand vibe coding in a particular context?**  
Yes, primarily in creative contexts like music production, game design, and interactive media, but I am also open to broader interpretations such as social media or collaborative coding.  

**3. What is your target audience for this research, and how familiar are they with the concept of vibe coding?**  
The audience is mostly beginners and creatives such as musicians, designers, and indie developers who may not be familiar with vibe coding at all. They might know coding basics but are more interested in the artistic or experiential side of programming.  

**4. Do you have any particular goals in mind for this research?**  
Yes, the goals are to understand the foundations of vibe coding, explore its applications in creative technology and media, and provide a practical guide or roadmap for people who want to start using it in their own projects.  

**5. Are you interested in practical implementations, theoretical frameworks, or both?**  
I am interested in both, as I want to explore the theoretical frameworks that explain why vibe coding matters and what makes it unique, as well as practical implementations such as tools, platforms, examples, and step by step approaches to begin.

## API Requirements

This application uses OpenAI's API with the following models:
- `gpt-4o` for main research tasks
- `gpt-4o-mini` for clarifying questions (cost optimization)

Make sure you have sufficient API credits and access to these models.

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is for educational purposes. Please respect OpenAI's usage policies when using their API.
