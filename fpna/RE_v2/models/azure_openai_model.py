"""
Module Name: azure_openai_model.py

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
#from langchain_community.chat_models import ChatOpenAI
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
TEMPERATURE = 0.5

# -----------------------------------------------------------------------------
# SECTION: Model Initialization
# -----------------------------------------------------------------------------

# Initialize OpenAI GPT model with the necessary configuration parameters
# Workaround for Pydantic ValidationError: 'proxies' argument in newer OpenAI versions
# Explicitly passing an httpx.Client avoids faulty automatic proxy detection in LangChain.
import httpx
model = ChatOpenAI(
    openai_api_key=os.getenv("OPENAI_API_KEY"),  # API key for OpenAI from environment variables
    temperature=TEMPERATURE,  # Set temperature for the model output
    http_client=httpx.Client()
)

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
