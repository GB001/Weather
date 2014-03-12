var express = require('express');
var async=require('async');
var app = express();
var request =require('request');
var cheerio =require('cheerio');
var schedule = require('node-schedule');

var cities=[];
var cityTemp=[];
var cityTempAPI=[];
var lowestTemp=[];

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set("view options", { layout: false });
app.use(express.static(__dirname+'/views'));

function getHTML(url, callback) //Recieves HTML from scraped site.
{
	request(url, function (error, response, html) {
		return callback(html);
	});
}


function getRes(url, callback) //Recieves JSON from Open Weather API.
{

	request(url, function (error, response, html) {
		return callback(response);
	});
}

function getProvinces(html, callback) // Weather site splits Provinces by links, so I had to aggregate them.
{
	var provinceLink=[];
	 var $ = cheerio.load(html);
	 $('.pipelist li').each(function(i, element){
	 	provinceLink.push($('a', this).attr('href'));	

	 });
	 return callback(provinceLink);
}

function getCities(f_callback) // Scrapes cities from navigated provinces.
{
	var pLinks;
	var cityList=[];
	var iterateProvince=function(item, callback) //Iterator to get city name and scrape link.
	{
		getHTML("http://weather.gc.ca"+item,function(html){
		
			 var $ = cheerio.load(html);
			 $('#bnLinks li').each(function(i, element){
				var data = {"city":$('a', this).text(), "link":$('a', this).attr('href')};
			 	cityList.push(data);
			 });	
			 callback();
		});
	
	}
	
	async.series([
		function(callback){
		
			getHTML("http://weather.gc.ca/canada_e.html", function(html)
			{
				getProvinces(html, function(provinceLinks)
				{
					pLinks=provinceLinks;
					callback();
				});
			});
			
		},
		
		function(callback){ //Iterates through provinces
		
			async.each(pLinks, iterateProvince, function(err){
				
				callback();

			});
		
		}], function(err)
		{
		
			cities=cityList;
			f_callback();
		
		});
			
}

function getiniTemperature(f_callback) //Scrapes temperature from city links
{
	var tempList=[];
	
	var iterateCity=function(item, callback) 
	{
		getHTML("http://weather.gc.ca"+item.link, function(html){
			 var $ = cheerio.load(html);
			 var s = $('#currentcond .temperature').text().split("°")[0];
			 if(s.length>0)
			 {
			 	 var temp=parseInt(s);
				 var data={"city": item.city, "temp":temp};
				// console.log(data)
				 tempList.push(data);
			}
			 callback();
		});
	
	}
	
	async.series([
		function(callback){
		
			async.each(cities, iterateCity, function(err){
				
				callback();

			});
			
		}], function(err)
		{
			cityTemp=tempList;
			orderTemperature(cityTemp, function(ordered){
				f_callback(ordered);
			})
		
		});

}

function orderTemperature(cList, callback) //Sorts collected temperatures and only takes the bottom 10.
{
	var ordered;
	cList.sort(function(a, b) { 
		return a.temp - b.temp;
	});
	
	ordered=cList.slice(0,10);	
	callback(ordered);
}

function getAPITemperature(f_callback) //Uses scraped city data to get temperature from API.
{
	var tempList=[];
	var iterateCity=function(item, callback)
	{
		var city=item.city.replace(" ", "_");
		getRes("http://api.openweathermap.org/data/2.5/weather?q="+city+",can&units=metric&APPID=54928a8baf432d8bea3e604c27a8274e", function(Res){

			try{
				 var cData=JSON.parse(Res.body);
			} catch (err) {
				console.log("Invalid data");
				//throw err;
			} finally {
	
				if(typeof cData!="undefined"&&typeof cData['main']!="undefined")
				{
					 var s = cData['main'].temp;
					// console.log(s)
				 	 var temp=parseInt(s);
					 var data={"city": item.city, "temp":temp};
					 tempList.push(data);
				}
				 callback();
			}
		});
	
	}
	async.series([	
		function(callback){

			async.each(cities, iterateCity, function(err){
	
				callback();

			});

		}], function(err)
		{
			cityTempAPI=tempList;
			console.log(cityTempAPI);
			orderTemperature(cityTempAPI, function(ordered){
				f_callback(ordered);
			})
		
		});
}

getCities(function(){  //Collects data as soon as the server runs. Scraping through hundreds of links takes nearly 20 seconds. 
	getiniTemperature(function(ordered){
	
		lowestTemp=ordered;
		console.log(lowestTemp);
	
	});
});


var cronJob = require('cron').CronJob;  //Set up a server job which updates the temperature every 3hrs.
var job = new cronJob('00 */3 * * *', function(){  
	getAPITemperature(function(ordered){
		lowestTemp=ordered;
		console.log(lowestTemp);
	});
  }, function () {
	console.log("Updated")
  },
  true /* Start the job right now */,
  "EST"
);

//General routing
app.get('/', function(req, res){
	console.log(JSON.stringify(lowestTemp));
	res.render('index', {
		params:JSON.stringify(lowestTemp)
	});
});

app.get('/getTemperature', function(req, res){
	console.log(JSON.stringify(lowestTemp));
	res.send(lowestTemp);
});





app.listen(2500);


