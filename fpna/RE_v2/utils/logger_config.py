"""
Module Name: logger_config.py

Description: 
This module sets up logging for the application, configuring both file and console 
handlers. It uses a rotating file handler to manage log file sizes and ensures logs 
are stored in a specified directory. The log messages are formatted to include the 
timestamp, log level, module, and message.

"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
from logging.handlers import RotatingFileHandler
import logging
import os

# -----------------------------------------------------------------------------
# SECTION: Constants and Configuration
# -----------------------------------------------------------------------------

# Define the directory and file names for logs
LOG_DIR = 'log_files'          # Directory to store log files
LOG_FILE = 'app.log'      # Name of the log file

# -----------------------------------------------------------------------------
# SECTION: Directory Setup
# -----------------------------------------------------------------------------

# Create logs directory if it doesn't exist
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# -----------------------------------------------------------------------------
# SECTION: Logger Configuration
# -----------------------------------------------------------------------------

# Configure formatter for log messages
formatter = logging.Formatter(
    '%(asctime)s - %(levelname)s - %(module)s - %(message)s'
)

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)  # Set the root logger level to DEBUG

# -----------------------------------------------------------------------------
# SECTION: File Handler Configuration
# -----------------------------------------------------------------------------

# Configure file handler with rotating logs, limiting the file size to 1MB and keeping 5 backup files
file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, LOG_FILE), maxBytes=1024 * 1024, backupCount=5
)
file_handler.setFormatter(formatter)
root_logger.addHandler(file_handler)  # Add the file handler to the root logger

# -----------------------------------------------------------------------------
# SECTION: Console Handler Configuration
# * Uncomment if logs have to be printed to console also along with log file.
# -----------------------------------------------------------------------------

# Configure console handler
# console_handler = logging.StreamHandler()
# console_handler.setFormatter(formatter)
# console_handler.setLevel(logging.DEBUG)  # Set the console handler level to DEBUG
# root_logger.addHandler(console_handler)  # Add the console handler to the root logger

# -----------------------------------------------------------------------------
# SECTION: Set Log Level to CRITICAL for Specific Unwanted Loggers
# -----------------------------------------------------------------------------

# List of unwanted loggers to silence by setting level to CRITICAL
unwanted_loggers = [
    'werkzeug', '_internal', '_base_client', '_trace', 'telemetry', 'connection', 
    'network', 'connectionpool', 'ocsp_snowflake', '_query_context_cache', 
    'httpx', 'urllib3', 'snowflake', 'sqlalchemy'
]

# Set the log level to CRITICAL for each unwanted logger
for logger_name in unwanted_loggers:
    logging.getLogger(logger_name).setLevel(logging.CRITICAL)

# -----------------------------------------------------------------------------
# SECTION: Usage examples for reference
# -----------------------------------------------------------------------------

# logger = logging.getLogger(__name__)
# logger.debug('This is a debug message')
# logger.info('This is an info message')
# logger.error('This is an error message')

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------