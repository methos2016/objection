// This hook attempts many ways to kill SSL pinning and certificate
// validations. The first sections search for common libraries and
// class methods used in many examples online to demonstrate how
// to pin SSL certificates.

// As far as libraries and classes go, this hook searches for:
//
//  - AFNetworking.
//      AFNetworking has a very easy pinning feature that can be disabled
//      by setting the 'PinningMode' to 'None'.
//
//  - NSURLSession.
//      NSURLSession makes use of a delegate method with the signature
//      'URLSession:didReceiveChallenge:completionHandler:' that allows
//      developers to extract the server presented certificate and make
//      decisions to complete the request or cancel it. The hook for this
//      Class searches for the selector and replaces it one that will
//      continue regardless of the logic in this method, and apply the
//      original block as a callback, with a successful return.
//
//  - NSURLConnection.
//      While an old method, works similar to NSURLSession, except there is
//      no completionHandler block, so just the successful challenge is returned.

// The more 'lower level' stuff is basically a reimplementation of the commonly
// known 'SSL-Killswitch2'[1], which hooks and replaces lower level certificate validation
// methods with ones that will always pass. An important note should be made on the
// implementation changes from iOS9 to iOS10 as detailed here[2]. This hook also tries
// to implement those for iOS10. 
//  [1] https://github.com/nabla-c0d3/ssl-kill-switch2/blob/master/SSLKillSwitch/SSLKillSwitch.m
//  [2] https://nabla-c0d3.github.io/blog/2017/02/05/ios10-ssl-kill-switch/

// Many apps implement the SSL pinning in interesting ways, if this hook fails, all
// is not lost yet. Sometimes, there is a method that just checks some configuration
// item somewhere, and returns a BOOL, indicating whether pinning is applicable or
// not. So, hunt that method and hook it :)

// Some base handles
var resolver = new ApiResolver('objc');
var NSURLCredential = ObjC.classes.NSURLCredential;

// Process the Frameworks and Classes First

// AFNetworking
if (ObjC.classes.AFHTTPSessionManager && ObjC.classes.AFSecurityPolicy) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: 'Found AFNetworking 3.0 library'
    });

    var AFSecurityPolicy_policyWithPinningMode = {};
    resolver.enumerateMatches('+[AFSecurityPolicy policyWithPinningMode:]', {
        onMatch: function (match) {
            AFSecurityPolicy_policyWithPinningMode.name = match.name;
            AFSecurityPolicy_policyWithPinningMode.address = match.address;
        },
        onComplete: function () { }
    });

    if (AFSecurityPolicy_policyWithPinningMode.address) {

        send({
            status: 'success',
            error_reason: NaN,
            type: 'ios-ssl-pinning-bypass',
            data: 'Found +[AFSecurityPolicy policyWithPinningMode:]'
        });

        Interceptor.attach(AFSecurityPolicy_policyWithPinningMode.address, {
            onEnter: function (args) {

                // typedef NS_ENUM(NSUInteger, AFSSLPinningMode) {
                //     AFSSLPinningModeNone,
                //     AFSSLPinningModePublicKey,
                //     AFSSLPinningModeCertificate,
                // };

                if (args[2] != '0x0') {

                    send({
                        status: 'success',
                        error_reason: NaN,
                        type: 'ios-ssl-pinning-bypass',
                        data: '[AFNetworking 3.0] setting AFSSLPinningModeNone for policyWithPinningMode:'
                    });

                    args[2] = '0x0';
                }
            }
        });
    }

    var AFSecurityPolicy_policyWithPinningModewithPinnedCertificates = {};
    resolver.enumerateMatches('+[AFSecurityPolicy policyWithPinningMode:withPinnedCertificates:]', {
        onMatch: function (match) {
            AFSecurityPolicy_policyWithPinningModewithPinnedCertificates.name = match.name;
            AFSecurityPolicy_policyWithPinningModewithPinnedCertificates.address = match.address;
        },
        onComplete: function () { }
    });

    if (AFSecurityPolicy_policyWithPinningModewithPinnedCertificates.address) {

        send({
            status: 'success',
            error_reason: NaN,
            type: 'ios-ssl-pinning-bypass',
            data: 'Found +[AFSecurityPolicy policyWithPinningMode:withPinnedCertificates:]'
        });

        Interceptor.attach(AFSecurityPolicy_policyWithPinningModewithPinnedCertificates.address, {
            onEnter: function (args) {

                // typedef NS_ENUM(NSUInteger, AFSSLPinningMode) {
                //     AFSSLPinningModeNone,
                //     AFSSLPinningModePublicKey,
                //     AFSSLPinningModeCertificate,
                // };

                if (args[2] != '0x0') {

                    send({
                        status: 'success',
                        error_reason: NaN,
                        type: 'ios-ssl-pinning-bypass',
                        data: '[AFNetworking 3.0] setting AFSSLPinningModeNone for policyWithPinningMode:withPinnedCertificates:'
                    });

                    args[2] = '0x0';
                }
            }
        });
    }
}

// NSURLSession
var search = resolver.enumerateMatchesSync('-[* URLSession:didReceiveChallenge:completionHandler:]');

if (search.length > 0) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: '[NSURLSession] Found ' + search.length + ' matches for URLSession:didReceiveChallenge:completionHandler:'
    });

    for (var i = 0; i < search.length; i++) {

        Interceptor.attach(search[i].address, {
            onEnter: function (args) {

                // 0
                // 1
                // 2 URLSession
                // 3 didReceiveChallenge
                // 4 completionHandler

                // get handlers on some arguments
                var receiver = new ObjC.Object(args[0]);
                var selector = ObjC.selectorAsString(args[1]);
                var challenge = new ObjC.Object(args[3]);

                send({
                    status: 'success',
                    error_reason: NaN,
                    type: 'ios-ssl-pinning-bypass',
                    data: '[NSURLSession] Got call to -[' + receiver + ' ' + selector + ']. Ensuring pinning passes.'
                });

                // get the original completion handler, and save it
                var completion_handler = new ObjC.Block(args[4]);
                var saved_completion_handler = completion_handler.implementation;

                // ignore everything the original method wanted to do,
                // and prepare the successful arguments for the original
                // completion handler
                completion_handler.implementation = function () {

                    // Example handler source

                    // SecTrustRef serverTrust = challenge.protectionSpace.serverTrust;
                    // SecCertificateRef certificate = SecTrustGetCertificateAtIndex(serverTrust, 0);
                    // NSData *remoteCertificateData = CFBridgingRelease(SecCertificateCopyData(certificate));
                    // NSString *cerPath = [[NSBundle mainBundle] pathForResource:@"swapi.co" ofType:@"der"];
                    // NSData *localCertData = [NSData dataWithContentsOfFile:cerPath];

                    // if ([remoteCertificateData isEqualToData:localCertData]) {

                    //     NSURLCredential *credential = [NSURLCredential credentialForTrust:serverTrust];
                    //     [[challenge sender] useCredential:credential forAuthenticationChallenge:challenge];
                    //     completionHandler(NSURLSessionAuthChallengeUseCredential, credential);

                    // } else {

                    //     [[challenge sender] cancelAuthenticationChallenge:challenge];
                    //     completionHandler(NSURLSessionAuthChallengeCancelAuthenticationChallenge, nil);
                    // }

                    var credential = NSURLCredential.credentialForTrust_(challenge.protectionSpace().serverTrust());
                    challenge.sender().useCredential_forAuthenticationChallenge_(credential, challenge);

                    // typedef NS_ENUM(NSInteger, NSURLSessionAuthChallengeDisposition) {
                    //     NSURLSessionAuthChallengeUseCredential = 0,
                    //     NSURLSessionAuthChallengePerformDefaultHandling = 1,
                    //     NSURLSessionAuthChallengeCancelAuthenticationChallenge = 2,
                    //     NSURLSessionAuthChallengeRejectProtectionSpace = 3,
                    // } NS_ENUM_AVAILABLE(NSURLSESSION_AVAILABLE, 7_0);
                    saved_completion_handler(0, credential);
                }
            }
        });
    }
}

// NSURLConnection
var search = resolver.enumerateMatchesSync('-[* connection:willSendRequestForAuthenticationChallenge:]');

if (search.length > 0) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: '[NSURLConnection] Found ' + search.length + ' matches for connection:willSendRequestForAuthenticationChallenge:'
    });

    for (var i = 0; i < search.length; i++) {

        Interceptor.replace(search[i].address, new NativeCallback(function (a, b, connection, challenge) {

            //TODO: Make sure we run the following method here too:
            // [[challenge sender] useCredential:credential forAuthenticationChallenge:challenge];

        }, 'void', ['pointer', 'pointer', 'pointer', 'pointer']));
    }
}

// Process the lower level methods, just like SSL-Killswitch2
//  https://github.com/nabla-c0d3/ssl-kill-switch2/blob/master/SSLKillSwitch/SSLKillSwitch.m

send({
    status: 'success',
    error_reason: NaN,
    type: 'ios-ssl-pinning-bypass',
    data: 'Hooking lower level methods: SSLSetSessionOption, SSLCreateContext, ' +
    'SSLHandshake and tls_helper_create_peer_trust'
});

// iOS9 and below

// Some constants
var errSSLServerAuthCompared = -9481;
var kSSLSessionOptionBreakOnServerAuth = 0;
var noErr = 0;
var errSecSuccess = 0;

// SSLSetSessionOption
var SSLSetSessionOption = new NativeFunction(
    Module.findExportByName('Security', 'SSLSetSessionOption'),
    'int', ['pointer', 'int', 'bool']);

Interceptor.replace(SSLSetSessionOption, new NativeCallback(function (context, option, value) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: '[SSLSetSessionOption] Called'
    });

    if (option === kSSLSessionOptionBreakOnServerAuth) {

        return noErr;
    }

    return SSLSetSessionOption(context, option, value);
}, 'int', ['pointer', 'int', 'bool']));

// SSLCreateContext
var SSLCreateContext = new NativeFunction(
    Module.findExportByName('Security', 'SSLCreateContext'),
    'pointer', ['pointer', 'int', 'int']);

Interceptor.replace(SSLCreateContext, new NativeCallback(function (alloc, protocolSide, connectionType) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: '[SSLCreateContext] Called'
    });

    var sslContext = SSLCreateContext(alloc, protocolSide, connectionType);
    SSLSetSessionOption(sslContext, kSSLSessionOptionBreakOnServerAuth, 1);

    return sslContext;

}, 'pointer', ['pointer', 'int', 'int']));

// SSLHandshake
var SSLHandshake = new NativeFunction(
    Module.findExportByName('Security', 'SSLHandshake'),
    'int', ['pointer']);

Interceptor.replace(SSLHandshake, new NativeCallback(function (context) {

    send({
        status: 'success',
        error_reason: NaN,
        type: 'ios-ssl-pinning-bypass',
        data: '[SSLHandshake] Called'
    });

    var result = SSLHandshake(context);

    if (result === errSSLServerAuthCompared) {

        return SSLHandshake(context);
    } else {

        return result;
    }
}, 'int', ['pointer']));

// iOS 10

// tls_helper_create_peer_trust
var tls_helper_create_peer_trust_export = Module.findExportByName('libcoretls_cfhelpers.dylib',
    'tls_helper_create_peer_trust');

// In the case of devices older than iOS 10, this export
// would not have been found.
if (tls_helper_create_peer_trust_export) {

    var tls_helper_create_peer_trust = new NativeFunction(tls_helper_create_peer_trust_export,
        'int', ['void', 'bool', 'pointer']);

    Interceptor.replace(tls_helper_create_peer_trust, new NativeCallback(function (hdsk, server, SecTrustRef) {

        send({
            status: 'success',
            error_reason: NaN,
            type: 'ios-ssl-pinning-bypass',
            data: '[tls_helper_create_peer_trust] Called'
        });

        return errSecSuccess;
    }, 'int', ['void', 'bool', 'pointer']));
}
