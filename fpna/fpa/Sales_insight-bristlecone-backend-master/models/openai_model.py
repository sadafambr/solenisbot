"""
Module Name: openai_model.py

Description:
This module initializes and configures the OpenAI GPT model using environment variables. 
It sets up the necessary API credentials, deployment parameters, and model configuration, 
such as temperature for output generation. The module leverages the `ChatOpenAI` class 
from the `langchain` library to interact with the OpenAI service.
"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
import os

# Third-party imports
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# -----------------------------------------------------------------------------
# SECTION: Environment Setup
# -----------------------------------------------------------------------------

# Load environment variables from .env file
load_dotenv()

# -----------------------------------------------------------------------------
# SECTION: Constants
# -----------------------------------------------------------------------------

# Temperature for model output; controls the creativity of the generated text
# Set to 0.0 for maximum consistency in responses
TEMPERATURE = 0.0

# -----------------------------------------------------------------------------
# SECTION: Model Initialization
# -----------------------------------------------------------------------------

# Initialize OpenAI GPT model with the necessary configuration parameters
model = ChatOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),  # API key for OpenAI from environment variables
    model_name="gpt-4.1-2025-04-14",  # Model name with default
    temperature=TEMPERATURE,  # Set temperature for the model output
    max_tokens=4000  # Ensure queries don't get truncated
)

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
