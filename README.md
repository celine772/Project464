Site link: https://celine772.github.io/Project464/Site/

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

A3 Testing results 
Test 1: Street addresses with or without the accent were foun succesfully on the map.
Test 2: Names of restarants and landmarks without the street addresses were found on the map.
Test 3: Locations that were types into the search bar that are not in Montreal were answered with a message saying that the location is not in Montreal.

## Pre-flight report (Lab 7)
| Check | Result | What I did |
| --- | --- | --- |
| 1. Cold start | pass
| 2. Read every label | pass
| 3. Ask twice | pass
| 4. The edge | fault | It was giving me different error messages deoending on whether I pressed the "Enter" button or the "Search" bar. | I fixed it by making the erorr messages the same in the code. Git commit "Changed error messages on the search bar to make them the same".
| 5. The data does not come | fault | It was not giving me and error message when the data was not loaded. | I added an error message for each feature incase the data is unable to load. Git commit "changed some error messages when data could not load".
| 6. On a phone (size view and my phone) | pass
| 7. Mouse in my pocket | pass
| 8. Accessibility audit | fault | I was getting an error that my attributes do not match their roles | I fixed it by changing the HTML. It did not impact the funtion of the search bar but it did improve the accesibility feature. Git commit "Improved the search bar accesibility feature".

## Part 3: what I found, and one fix
Evidence: In both of my rounds, my testers were confused when they first opened my webpage. That's because they were met with an empty map without any data points. They thought that the map was broken. But, once they started to press on the map and zoom in, the points appreared. 
Severity: The severity is 3. I chose 3 because they thought the map was completely broken and could not use the site at all. If I wasn't sitting next to them they probably would have just closed the site and never opened it again.
My change: I will change the code so that the points appear on the map right when the site opens, and not only when the map is pressed on.
Recheck: I asked one of my classmates to try opening the site on thier device, and the points loaded immediately. The problem was fixed.

## My before and after pictures 
This is a "before" picture of map which shows how the points on the map would not load on the webpage, until the user pressed on the map itself.
![Before Screenshot](Screenshots/screenshot%3Abefore.png)

This is an "after" picture which shows how the points now load right away when the webpage is opened.
![After Screenshot](Screenshots/screenshot%3Aafter.png)

Which lines do the work: Lines 249 and 358 in app.js are what fixed the problem. They are what refreshes the point markers so they show on the map regardless of whether the user clicks on the map or not.

What I do not fully understand yet: I understand the fix, but I still don't fully understand what the problem was to begin with. I would like to do some digging so I know what to avoid for my next map.

A3 AI disclosure: I used an integrated copilot during A3. It helped my create my search bar feature and then also helped me add an autocomplete feature to it which made the feature much more usable. Co-pilot also assisted me in finding the problem that was causing my  data not to load on the map. I asked why the points were not loading initally and it answered it is a problem with the map's "inital refresh time". It gave me 2 different solutions but I decided to go with the option that refreshed only the points, instead of the entire map since I thought a whole refresh would make the map too slow. I then went and checked the map again myself to make sure nothing else was accidentaly changed, and then went to ask a classmate to check it on their laptop.

What my map remembers: My map remembers addresses that can be "Favorited" by the user. This can be their hotel, an attraction they want to visit, or a restaurant they like. The records are perosnally kept on the users browser and cannot be seen by anyone else. The user can easily clear any unanted "Favorite" points by pressing "remove point". This works the memory.js file which is where the code for this feature is kept. It also works the index.html file since it is shown on the webpage.