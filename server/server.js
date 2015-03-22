Meteor.methods({

  getTax:function(){

  	//var tax = Settings.findOne( { Key:'tax'});;
    var tax = Settings.findOne({$and : [{Key: "tax"}, {Value : {"$exists" : true, "$ne" : ""}}]});

  	console.log('tax = ' + tax);


  	return tax;

  },


  getUUID: function () {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    console.log("uuid = " + uuid);
    return uuid;
},

	addToCart:function(qty, product, session,Name, Category, Charge){
		qty = Number (qty);
		if(qty>0)
		{
			
			//var itemFromCart = CartItems.findOne( { $and:[{product:product}, {session:session}]});
			//if(itemFromCart)
			//{
				
			//console.log("itemFromCart.count() = " +itemFromCart.length)

				//for (var key in itemFromCart )
				//{
				//	console.log("itemFromCart.key = " + itemFromCart[key]);
				//}
				//qty +=Number(itemFromCart.qty);
				//console.log("qty = " + qty);

			

		
			CartItems.update({product:product, session:session},{qty:qty, product:product, session:session,Name:Name, Category:Category, Charge:Charge},{upsert:true});

			//CartItems.insert({qty:qty, product:product, session:session});
			console.log('Added the product = ' + product  + ' for session id = ' + session);
			
		}
		else if (qty=== 0) 
		{
				console.log('Quantity is Zero');

				CartItems.remove ({product:product, session:session}, function(error, result){

					if (error)
					{
						console.log('Trouble removing the product = ' + product  + ' for session id = ' + session);
					}

				});

		}
		else
		{
				console.log('addToCart: Invalid Quantity');

		}
	},
	
	removeCartItem:function(product,sessionId ){
		console.log('Removing from Cart: Sessionid = ' + sessionId + ' :: product' +product);
		CartItems.remove({session:sessionId, product:product});
	},
		removeAllCartItem:function(sessionId){
		CartItems.remove({session:sessionId});
	},

	getOrder:function(sessionId){

		console.log("sessionId = " + sessionId);
		var order = Orders.findOne({UniqueId:sessionId});
		console.log("order = " + order);

		return order;

	},

	getNextSequenceValue: function (){
		
		try{

			        var currentId = Counters.findOne({},{sort:{orderNumber:-1}}) || 1;

			        	for(var key in currentId)
			        	{
			        		console.log(currentId[key]);
			        	}

        			var nextOrderumber= Number (currentId.orderNumber) + 1;
        			Counters.insert({orderNumber:nextOrderumber});
        			console.log(nextOrderumber);

        			var sequence = Counters.findOne({orderNumber:nextOrderumber});
        			for(var key in sequence)
        			{
        				console.log(key + " = " +sequence[key]);
        			}
        			return sequence;

        		}catch(error)
        		{
        			console.log(error);
        		}
   	
	},

	orderItems:function(sessionId, contactInfo, sequence){

			console.log('In OrderItems');

			       for(var key in sequence)
        			{
        				console.log(key + " = " +sequence[key]);
        			}
			var order = {};
			order.Status=STATE_ONE;
			order.OrderNumber=sequence.orderNumber;
			order.UniqueId=sequence._id;

			var gmt_offset = Settings.findOne({Key: 'gmt_offset'})

			console.log('gmt_offset = ' + gmt_offset.Value );

			var now =moment().utcOffset(Number(gmt_offset.Value)).format('MM/DD/YYYY hh:mm:ss A');

			console.log('now = ' + now);

			order.TimeOrderReceived = now;
			order.CustomerName=contactInfo.contactName;
			order.CustomerPhone=contactInfo.phoneNumber;
			order.CustomerEmail=contactInfo.email;
			order.MessageToKitchen = contactInfo.messageToKitchen;

			var itemString='';
			var items=[];

			//console.log("Order Object before loop" + JSON.stringify(order, null, 4));

			var itemsInCart= CartItems.find({session:sessionId});

			console.log('Number of items in cart for session ' + sessionId
				+ ', contact  ' + order.CustomerPhone + ' ' +order.CustomerEmail +' = ' + itemsInCart.count());

			var totalItemCount = 0;
			var subTotal = 0;

			itemsInCart.forEach (function (cartitems)

				{
					totalItemCount += Number(cartitems.qty);

					for(key in cartitems)
					{
						console.log(key + "  =  " + cartitems[key]);
					}


					subTotal +=  (Number(cartitems.Charge) * cartitems.qty);
					itemString = itemString + cartitems.qty + " - " + cartitems.Name +'\n';
   					items.push(
   					{ 
        				"name" : cartitems.Name,
        				"qty"  : cartitems.qty
					});

				cartitems.UniqueId = order.UniqueId;

				OrderedItems.update({product:cartitems.product, UniqueId:order.UniqueId},cartitems,{upsert:true});


   			});
			order.itemsObject=items;
			order.Items= itemString.substring(0, itemString.length-1); // Substring to get rid of the last new character
			order.TotalItem = totalItemCount;	
			order.SubTotal = Number (subTotal.toFixed(2));


			tax = Meteor.call('getTax');
            var taxValue = Number(tax.Value);

            if(taxValue > 0)
            {
            	order.tax = subTotal * taxValue;

            }
            else

            {
            	order.tax = 0;
            }	

			order.Total = Number((subTotal + order.tax).toFixed(2));

			order.sessionId =sessionId;



            console.log("Done Building the Order Object" + JSON.stringify(order, null, 4));

			var itemsToOrder = Orders.insert(order, function(error, _id)
				{

					if(error)
					{
						config.log("touble insert the order to mongodb " + order);
						throw new Meteor.Error(error);

					}
					else
					{
						Meteor.call('removeAllCartItem',sessionId);
						try{

							var https = Meteor.npmRequire('request');
							var options ={
								url:'https://script.google.com/macros/s/AKfycbykFPq1TAvdQD40RXARQCUFIqNmIKgwrb8R4YZlHjiY15qTl7c/exec',
								method: 'POST',
								body: order,
								json: true,
								followAllRedirects: true

							}
						    https.post(options, function (error, response, body){
								console.log("error : " + error);
								console.log("response.statusCode : " + response.statusCode);
								console.log("body : " + body);

							});

							return order;
							//var result = HTTP.call(	'POST', 
							//						'https://script.google.com/macros/s/AKfycbzu3126b_QhgPwuwoStDdoF8AVqf2XFfAQ-ars_YmR7SEZgeSc/exec',
                           	//						{ data:order, followRedirects:true }
                           	//					);
							//var result = HTTP.call('GET', 'https://script.google.com/macros/s/AKfycbzu3126b_QhgPwuwoStDdoF8AVqf2XFfAQ-ars_YmR7SEZgeSc/exec');
							//console.log("result = " + result);
							//for (var key in result)
							//{
							//
							//	console.log("key = " +  key + " : " + result[key]);
							//}
						}catch (e)
						{
							console.log(e);
						}
						//return order.items;
					}
				});

	}
});