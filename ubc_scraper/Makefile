# Define variables
PYTHON := python
HTML_CACHE_DIR := ./html_cache
OUTPUT_DIR := ./output
SCRAPER_SCRIPT := ./optimized_scraper.py

# Timestamp for filenames
TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)
ROOMS_CSV := $(OUTPUT_DIR)/rooms_$(TIMESTAMP).csv
BOOKINGS_CSV := $(OUTPUT_DIR)/bookings_$(TIMESTAMP).csv

# Default target
all: run

# Ensure output directory exists
$(OUTPUT_DIR):
	mkdir -p $(OUTPUT_DIR)

# Target to run the scraper in production mode
run: $(OUTPUT_DIR)
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)
	
	@echo "Starting scraper in PRODUCTION mode: $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV)
	@echo "Scraper finished. Output files:"
	@echo "  $(ROOMS_CSV)"
	@echo "  $(BOOKINGS_CSV)"

# Target to run the scraper in debug mode
debug: $(OUTPUT_DIR)
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)
	
	@echo "Starting scraper in DEBUG mode: $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV) --debug
	@echo "Scraper finished. Output files:"
	@echo "  $(ROOMS_CSV)"
	@echo "  $(BOOKINGS_CSV)"

# Run without cleaning cache
run_nocache: $(OUTPUT_DIR)
	@echo "Starting scraper (using existing cache): $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV)
	@echo "Scraper finished. Output files:"
	@echo "  $(ROOMS_CSV)"
	@echo "  $(BOOKINGS_CSV)"

# Debug mode without cleaning cache
debug_nocache: $(OUTPUT_DIR)
	@echo "Starting scraper in DEBUG mode (using existing cache): $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV) --debug
	@echo "Scraper finished. Output files:"
	@echo "  $(ROOMS_CSV)"
	@echo "  $(BOOKINGS_CSV)"

# Clean HTML cache only
clean:
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)

# Clean cache and all CSV output files
clean_all:
	@echo "Cleaning HTML cache and all CSV output files"
	rm -rf $(HTML_CACHE_DIR)
	rm -rf $(OUTPUT_DIR)

.PHONY: all run debug run_nocache debug_nocache clean clean_all
