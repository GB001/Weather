var map = new google.maps.Map(document.getElementById('map'), {
	zoom: 3,
	mapTypeId: google.maps.MapTypeId.ROADMAP,
	scrollwheel: false      
});

var markers= [];
var tempMarkers= [];
var locations;
	
function updateOverlays(callback) {
	console.log(markers)
	for (var i = 0; i < markers.length; i++ ) {
		markers[i].setMap(null);
	}
		markers.length = 0;
		callback();
}

function update(reload)
{

	$.get("/getTemperature", function(data)
	{
		locations=data;	
		updateOverlays(function()
		{
			getMarkers(null, reload) 
		});

	});
	

}


var infowindow=new google.maps.InfoWindow();

function getMarkers(i, update) //Had to improvise a loop as the geocoder API is asynchronous
{
	if(!i)
		i=0;
	var cLocation=locations[i].city+", Canada";
	var cTemp=locations[i].temp;

	var geocoder = new google.maps.Geocoder();
	geocoder.geocode({
		'address': cLocation
	}, 
	function(results, status) {

		if(status == google.maps.GeocoderStatus.OK) {

			var marker=new google.maps.Marker({
				position: results[0].geometry.location,
				map: map,
				title: results[0].address_components[0].long_name+" "+locations[i].temp
			});
	
			tempMarkers.push(marker);

		 	 google.maps.event.addListener(marker, 'click', function() {
		 	    infowindow.setContent(marker.title);
			    infowindow.open(map,marker);
			  });
		}
		i++;
		if(i<locations.length)
			getMarkers(i);
		else if(i==locations.length)
		{
			if(!update)
				map.setCenter(results[0].geometry.location);
			markers=tempMarkers;
			tempMarkers.length = 0;
		}
	});


}
    
$( document ).ajaxStart(function() {
	$( "#bowlG" ).show();
	$( ".title_city img" ).hide();
});

$( document ).ajaxSuccess(function() {
	setTimeout(function(){
		$( "#bowlG" ).hide();
		$( ".title_city img" ).show();
	}, 2000)
});
	
	
update();

setInterval(function(){

	update(reload);

}, 10800000)
