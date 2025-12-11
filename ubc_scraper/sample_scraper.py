
# SAMPLE BASED OF:
# https://www.youtube.com/watch?v=lM23Y1XFd2Q

from selenium import webdriver
from selenium.webdriver.chrome.service import Service

web     = 'https://www.audible.com/search'
driver = webdriver.Chrome()

# Open website link
driver.get(web)
print(driver.title)
# driver.quit()

## is a list
products = driver.find_elements(by='xpath', value='//li[contains(@class,"productListItem")]')

for product in products:
    name    = product.find_element(by='xpath', value='.//h3[contains(@class, "bc-heading")]').text
    author  = product.find_element(by='xpath', value='.//li[contains(@class, "authorLabel")]').text
    runtime = product.find_element(by='xpath', value='.//li[contains(@class, "runtimeLabel")]').text

    print(f"Name    = {name}")
    print(f"Author  = {author}")
    print(f"Runtime = {runtime}")


