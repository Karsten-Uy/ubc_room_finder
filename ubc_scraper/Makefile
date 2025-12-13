# Define variables
PYTHON := python
HTML_CACHE_DIR := ./html_cache
SCRAPER_SCRIPT := ./optimized_scraper.py
ROOMS_CSV := rooms.csv
BOOKINGS_CSV := bookings.csv

# Default target
all: run

# Target to run the scraper in production mode
run:
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)
	
	@echo "Starting scraper in PRODUCTION mode: $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV)

# Target to run the scraper in debug mode
debug:
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)
	
	@echo "Starting scraper in DEBUG mode: $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV) --debug

# Target to run without cleaning cache (useful for resuming)
run_nocache:
	@echo "Starting scraper (using existing cache): $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV)

# Target to run debug without cleaning cache
debug_nocache:
	@echo "Starting scraper in DEBUG mode (using existing cache): $(SCRAPER_SCRIPT)"
	$(PYTHON) $(SCRAPER_SCRIPT) --cache-dir $(HTML_CACHE_DIR) --rooms-csv $(ROOMS_CSV) --bookings-csv $(BOOKINGS_CSV) --debug

# Target to clean up the cache only
clean:
	@echo "Cleaning HTML cache directory: $(HTML_CACHE_DIR)"
	rm -rf $(HTML_CACHE_DIR)

# Target to clean cache and output files
clean_all:
	@echo "Cleaning HTML cache and CSV output files"
	rm -rf $(HTML_CACHE_DIR)
	rm -f $(ROOMS_CSV) $(BOOKINGS_CSV)

.PHONY: all run debug run_nocache debug_nocache clean clean_all