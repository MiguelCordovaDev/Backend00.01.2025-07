 $(function () {

        var socket = io.connect();
        var message = $('#message');
        var messageForm = $('#messageForm');
        var chat = $('#chat');
        var username = $('#username');
        var user ;

//        username.text('prashant');

        var initial = 0;
//================initilize message=======
        socket.emit('username' , "prashant");
        socket.emit('initial-messages' , "initial");
//========================================
        messageForm.submit(function (data) {
           data.preventDefault();
           socket.emit('send-message' , message.val(), username.html());
			$('input').val('');
        });
        socket.on('new-message' , function (data) {
			if(data.username === user) {
				chat.append('<li > <div class="msj-rta macro"> <div class="text text-l">' + data.msg + '</div></div></li>');
			}else {
				chat.append('<li > <div class="msj macro"> <div class="text text-r">'+data.username+'  :  ' + data.msg + '</div></div></li>');
			}
			$('.chat').scrollTop($("ul.chat").prop('scrollHeight'));
        });
        socket.on('initial-message' , function (data) {
            if(initial === 0) {
                var arr = $.parseJSON(data.msg);
                for (var i = 0; i < arr.length; i++) {
                    if(arr[i].user === user) {
                        chat.append('<li > <div class="msj-rta macro"> <div class="text text-l">' + arr[i].message + '</div></div></li>');
                    }else {
                        chat.append('<li > <div class="msj macro"> <div class="text text-r">' +arr[i].user +'  :   '+ arr[i].message + '</div></div></li>');
                    }

                }
                $('.chat').scrollTop($("ul.chat").prop('scrollHeight'));
                initial++;
            }
        });
        socket.on('username' , function (data) {
            username.text(data.username);
            user = data.username;
        });
		socket.on('typing' , function (data) {
			console.log(data)
			$('.status').html(data.msg);
        });
		$('#message').focus( function () {
			socket.emit('typing', user + ' is typing...');
		});
		$('#message').focusout( function () {
			socket.emit('typing', '');
		});
    });