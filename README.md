# SemenDaemon
Welcome to SemenDaemon, an unofficial addon for Iwara, that aims to (mostly) replace the slow and sucky default video search tools present on the site.

# Features
<p>
    <ul>
        <li><b>Instant search</b> - unless your PC is a complete potato, all search results will be displayed nigh instantly</li>
        <li><b>Extensive filtering</b> - You can sort and filter the search results by likes, views, duration, artists, characters, general tags or any combination of them.</li>
        <li><b>Filter favorites</b> - You can store your favorite filter settings as favorites and then apply them with a single click</li>
        <li><b>Improved tagging</b> - SemenDaemon combines tagging from other sites where these videos exist, so even if the video has no tags on Iwara, it might still have tags in SemenDaemon's database, allowing you to find videos, which you could never find via Iwara's search.</li>
        <li><b>Reducing server load</b> - Because all of the searching happens fully locally on your PC (explained below), it places very little load* on the Iwara servers.</li>
    </ul>
</p>

# How it works
SemenDaemon is a userscript, which you can install in your browser by using a script manager like Greasemonkey, Tampermonkey, or Violentmoney and it then runs automatically when you visit Iwara's website. 
SemenDaemon uses a local content database stored on your computer, and thanks to that all searching and filtering happens fully offline, with no internet needed, and is thus near instanteneous. 
The only server traffic generated is when your browser loads the thumbnails and profile pictures in search results or if you perform a database update.

# Downsides
There are some tradeoffs in exchange for the speed you will be getting. Due to the fact that SemenDaemon works with an offline database, the existing entries in the database will not be kept up-to-date, this means that if the uploader changes the title of the video, or the number of likes goes up over time, these changes will not be reflected in the offline database. However, SemenDaemon has the ability to fetch new videos which do not yet exist in its database to keep its catalog up to date (it's just that any further changes to those videos that already exist in the database will not be recorded).

# How to install
It's very simple, download the SemenDeamon .js file and install it with your userscript manager of choice, I use Violentmonkey for example. After that go to Iwara, open SemenDaemon, read the Introduction page it shows you and import the database file, which you can also download here. Don't forget to unzip it first.

# Screenshots
Main window
![image](https://github.com/user-attachments/assets/ba092004-bb53-4a78-916b-3a51197cd32d)

Filter guide
![image](https://github.com/user-attachments/assets/ee60248a-a3f4-4499-a84c-a46f55d1f32a)


<p><b>SemenDaemon is in no way associated with Iwara in any official capacity.</b></p>
