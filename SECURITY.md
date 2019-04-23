# Reporting Security Issues

We take security very seriously at GoDaddy. We appreciate your efforts to
responsibly disclose your findings, and will make every effort to acknowledge
your contributions.

## Disclosure policy

In order to give the community time to respond and upgrade, we strongly urge you
report all security issues privately.

To report a security issue in one of our Open Source projects email us directly
at **oss@godaddy.com** and include the word "SECURITY" in the subject line.

This mail is delivered to our Open Source Security team.

## Security update policy

After the initial reply to your report, the team will keep you informed of the
progress being made towards a fix and announcement, and may ask for additional
information or guidance.

## Secure configuration

By default Carpenterd-worker runs as an child of [Carpenterd]. If carpenterd is 
properly configured the security risks should be minimal. However keep in mind 
that carpenterd-worker runs builds (webpack, browserify, etc) and therefor could 
execute JS scripts. Only execute builds from trusted sources to prevent execution 
of malicious scripts.

## Known security issues and future enhancements

None

[Carpenterd]: https://github.com/godaddy/carpenterd
