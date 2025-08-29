# -*- coding: utf-8 -*-
"""Deep Research Clone - Streamlit App

Streamlit version of the Deep Research Clone following the exact flow
from the original deep_research_clone.py file with clean UI.
"""

import streamlit as st
from openai import OpenAI
import json
import os
import itertools
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Model Configuration (matching original exactly) ---
MODEL = "gpt-4o"
MODEL_MINI = "gpt-4o-mini"
TOOLS = [{'type': 'web_search'}]

# Developer message definition (matching original exactly)
DEVELOPER_MESSAGE = """
You are an expert Deep Researcher.
You provide complete and in depth research to the user.
"""

def get_openai_client():
    """Get OpenAI client with API key validation"""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        st.error('🔑 OPENAI_API_KEY not set. Please set it in your environment or .env file.')
        st.stop()
    return OpenAI(api_key=api_key)

# --- Step 1: Get topic ---
def get_topic():
    """Get research topic from user"""
    return st.text_input('🔬 Research topic:', key='topic').strip()

# --- Step 2: Clarifying questions ---
def get_clarifying_questions(client, topic):
    """Generate 5 clarifying questions (matching original exactly)"""
    # Define prompt to clarify (matching original exactly)
    prompt_to_clarify = f"""
Ask 5 numbered clarifying question to the user about the topic: {topic}.
The goal of the quesitons is to understand the intended purpose of the research.
Reply only with the questions
"""
    
    clarify = client.responses.create(
        model=MODEL_MINI,
        input=prompt_to_clarify,
        instructions=DEVELOPER_MESSAGE,
    )
    
    # Get the questions (matching original exactly)
    questions = clarify.output[0].content[0].text.split("\n")
    # Filter out empty questions
    questions = [q.strip() for q in questions if q.strip()]
    
    return questions, clarify.id

# --- Step 3: Collect answers ---
def get_answers(questions):
    """Collect answers to clarifying questions"""
    answers = []
    st.subheader("📝 Please answer these clarifying questions:")
    
    for i, question in enumerate(questions):
        answer = st.text_input(question, key=f'answer_{i}')
        answers.append(answer)
    return answers

# --- Step 4: Generate goal and queries ---
def get_goal_and_queries(client, topic, questions, answers, clarify_id):
    """Generate research goal and search queries (matching original exactly)"""
    # Write the prompt_goals prompt (matching original exactly)
    prompt_goals = f"""
Using the user answers: \n{answers} to the questions: \n{questions} \n, write a goal sentence and 5 web search queries for the research about {topic}
Output: A JSON list of the goal and the 5 web search quesries that will reach it
Format: {{"goal": "...", "queries": ["q1", ....]}}
"""
    
    # Use the responses API (matching original exactly)
    goal_and_queries = client.responses.create(
        model=MODEL,
        input=prompt_goals,
        previous_response_id=clarify_id,
        instructions=DEVELOPER_MESSAGE,
    )
    
    # Formatting and loading as JSON (matching original exactly)
    plan = json.loads(goal_and_queries.output[0].content[0].text)
    return plan, goal_and_queries.id

# --- Step 5: Run web search ---
def run_search(client, q):
    """Run a single web search query (matching original exactly)"""
    web_search = client.responses.create(
        model=MODEL,
        input=f"Search: {q}",
        # previous_response_id=goal_and_queries.id,  # Commented out like original
        instructions=DEVELOPER_MESSAGE,
        tools=TOOLS
    )
    return {'query': q,
            'resp_id': web_search.output[1].id,
            'research_output': web_search.output[1].content[0].text}

# --- Step 6: Evaluate if goal is met ---
def evaluate(client, goal, collected):
    """Evaluate if collected data satisfies the research goal (matching original exactly)"""
    review = client.responses.create(
        model=MODEL,
        input=[
            {"role": "developer", "content": f"Research goal: {goal}"},
            {"role": "assistant", "content": json.dumps(collected)},
            {"role": "user", "content": "Does this information will fully satisfy the goal? Answer Yes or No only."}
        ],
        instructions=DEVELOPER_MESSAGE,
        # tools=TOOLS  # Commented out like original
    )
    return "yes" in review.output[0].content[0].text.lower()

# --- Step 7: Final synthesis ---
def synthesize(client, goal, collected):
    """Generate the final research report (matching original exactly)"""
    report = client.responses.create(
        model=MODEL,
        input=[
            {"role": "developer", "content": (f"Write a complete and detailed report about research goal: {goal}. "
                                            "Cite Sources inline using [n] and append a reference "
                                            "list mapping [n] to url")},
            {"role": "assistant", "content": json.dumps(collected)},
        ],
        instructions=DEVELOPER_MESSAGE,
    )
    return report.output[0].content[0].text

# --- Main Streamlit UI ---
def main():
    """Main application function with clean UI"""
    st.set_page_config(
        page_title="Deep Research Clone",
        page_icon="🔬",
        layout="wide"
    )
    
    st.title("🔬 Deep Research Clone")
    st.write("AI-powered research assistant with web search following the exact original flow.")
    
    # Get OpenAI client
    client = get_openai_client()
    
    # Step 1: Topic
    topic = get_topic()
    if not topic:
        st.info("👆 Enter a research topic to begin.")
        return
    
    # Step 2: Clarifying questions
    if 'clarify_data' not in st.session_state or st.session_state.get('last_topic') != topic:
        with st.spinner("🤔 Generating clarifying questions..."):
            questions, clarify_id = get_clarifying_questions(client, topic)
            st.session_state['clarify_data'] = (questions, clarify_id)
            st.session_state['last_topic'] = topic
    else:
        questions, clarify_id = st.session_state['clarify_data']
    
    # Step 3: Answers
    answers = get_answers(questions)
    if not all(answer.strip() for answer in answers):
        st.info("📝 Please answer all clarifying questions to continue.")
        return
    
    # Step 4: Goal and queries
    if 'goal_plan' not in st.session_state or st.session_state.get('last_answers') != answers:
        with st.spinner("🎯 Generating research goal and queries..."):
            plan, goal_queries_id = get_goal_and_queries(client, topic, questions, answers, clarify_id)
            st.session_state['goal_plan'] = plan
            st.session_state['goal_queries_id'] = goal_queries_id
            st.session_state['last_answers'] = answers
    else:
        plan = st.session_state['goal_plan']
        goal_queries_id = st.session_state['goal_queries_id']
    
    goal = plan["goal"]
    queries = plan["queries"]
    
    # Display goal and queries
    st.markdown("---")
    st.subheader("🎯 Research Goal")
    st.info(goal)
    
    st.subheader("🔍 Initial Search Queries")
    for i, query in enumerate(queries, 1):
        st.write(f"{i}. {query}")
    
    # Step 5: Research loop (matching original iterative approach)
    if st.button("🚀 Start Research", type="primary") or st.session_state.get('research_started'):
        st.session_state['research_started'] = True
        
        # Initialize or get existing collected data
        collected = st.session_state.get('collected', [])
        current_queries = st.session_state.get('current_queries', queries)
        iteration_count = st.session_state.get('iteration_count', 0)
        
        # Safety limit for iterations
        max_iterations = 5
        
        if iteration_count < max_iterations:
            st.markdown("---")
            st.subheader(f"🔬 Research Iteration {iteration_count + 1}")
            
            # Run searches for current queries
            progress_bar = st.progress(0)
            
            for i, q in enumerate(current_queries):
                # Check if we already searched this query
                if not any(item['query'] == q for item in collected):
                    progress = (i + 1) / len(current_queries)
                    progress_bar.progress(progress)
                    
                    with st.spinner(f"🔍 Searching: {q}"):
                        result = run_search(client, q)
                        collected.append(result)
                        
                        # Show search result preview
                        with st.expander(f"📄 Results for: {q}", expanded=False):
                            preview = result['research_output'][:300] + "..." if len(result['research_output']) > 300 else result['research_output']
                            st.text_area("Search Output:", value=preview, height=100, disabled=True)
            
            # Update session state
            st.session_state['collected'] = collected
            st.session_state['iteration_count'] = iteration_count + 1
            
            # Step 6: Evaluate completeness
            st.subheader("🧐 Evaluating Research Completeness")
            with st.spinner("📊 Checking if goal is satisfied..."):
                goal_satisfied = evaluate(client, goal, collected)
            
            if goal_satisfied:
                st.success("✅ Research goal satisfied! Generating final report...")
                
                # Step 7: Final synthesis
                with st.spinner("📝 Writing comprehensive research report..."):
                    final_report = synthesize(client, goal, collected)
                
                st.markdown("---")
                st.subheader("📋 === FINAL REPORT ===")
                st.markdown(final_report)
                
                # Download button
                st.download_button(
                    label="📄 Download Report",
                    data=final_report,
                    file_name=f"research_report_{topic.replace(' ', '_')}.md",
                    mime="text/markdown"
                )
                
                # Reset research state
                st.session_state['research_started'] = False
                st.session_state['collected'] = []
                st.session_state['iteration_count'] = 0
                
                if st.button("🔄 Start New Research"):
                    # Clear all session state
                    for key in list(st.session_state.keys()):
                        del st.session_state[key]
                    st.rerun()
                    
            else:
                st.warning("⚠️ More research needed. Generating additional queries...")
                
                # Generate additional queries (matching original exactly)
                with st.spinner("🔍 Generating new search queries..."):
                    more_searches = client.responses.create(
                        model=MODEL,
                        input=[
                            {"role": "assistant", "content": f"Current data: {json.dumps(collected)}"},
                            {"role": "user", "content": f"This has not met the goal: {goal}. Write 5 other web searches to achieve the goal"},
                        ],
                        instructions=DEVELOPER_MESSAGE,
                        previous_response_id=goal_queries_id,
                    )
                    
                    try:
                        # Parse new queries (fixing the typo from original)
                        new_queries_text = more_searches.output[0].content[0].text
                        new_queries = json.loads(new_queries_text)
                        if isinstance(new_queries, list):
                            st.session_state['current_queries'] = new_queries
                            st.info("🆕 New search queries generated. Click 'Start Research' again.")
                        else:
                            st.error("Could not parse additional queries.")
                    except json.JSONDecodeError:
                        st.error("Could not parse additional queries as JSON.")
        else:
            st.warning("⚠️ Reached maximum iteration limit for safety.")
            
            # Show final results anyway
            if collected:
                st.subheader("📊 Research Summary")
                st.info(f"Conducted {len(collected)} searches across {iteration_count} iterations")
                
                with st.expander("📄 View All Search Results", expanded=False):
                    for i, result in enumerate(collected, 1):
                        st.markdown(f"**{i}. {result['query']}**")
                        st.text_area(f"Results {i}:", value=result['research_output'][:500] + "..." if len(result['research_output']) > 500 else result['research_output'], height=150, disabled=True)
                        st.markdown("---")

if __name__ == "__main__":
    main()