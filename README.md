Problem: Mapping all the spots in Montreal where free WIFI is available.
Audience: Toursits 
Core action: Clearly illustrating where tourists can find free wifi.
Boundary: Will not include the un-incorporated cities in Montreal
Data: CSV from open data montreal.
AI disclosure: Github Copilot assisted with the writing and editing of this code. My lane is: Blue (bring your own agent)

My boundary for the MVP: I really wanted to also include toursit spots in Montreal, so that visitors can see where there are available WIFI spots near those areas. I have the data, however it still needed a lot of editing which I could not finish in time for the MVP. I will be adding it to my final project instead. I also wanted to make the map downloadable for offline use, so people could carry it around with them as they move around the city, but I have not been able to figure out how to do that yet. 

##A3 Feature: 
For A3 I will add a search bar, so that my reader can find a location.
It has depth because it responds to the user by showing them features near the location that they searched for.
I will know it works when I type in an address and the map pans to the correct area.

A3 usability testing for live feature:
Test 1: I type in a street address without the accent.
    Expected: The map pans to that address
Test 2: I type in the name of a restaurant. 
    Expeected: It pans to that area on the map.
Test 3: I type in an address which is not in Montreal.
    Expected: Map sends a message that the address could not be found.

## Pre-flight report (Lab 7)
| Check | Result | What I did |
| --- | --- | --- |
| 1. Cold start | pass
| 2. Read every label | pass
| 3. Ask twice | pass
| 4. The edge | fault | It was giving me different error messages deoending on whether I pressed the "Enter" button or the "Search" bar. | I fixed it by making the erorr messages the same in the code.
| 5. The data does not come | pass
| 6. On a phone (size view and my phone) | pass
| 7. Mouse in my pocket | pass
| 8. Accessibility audit | ... | ... |