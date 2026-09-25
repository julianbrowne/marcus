
cat ${1} \
	| sed -e "s/\./\n/g"     \
	| sed -e "s/\?/\n/g"     \
	| sed -e "s/\!/\n/g"     \
	| sed -e "s/\- / /g"     \
	| sed -e "s/\,//g"       \
	| sed -e "s/ \-/ /g"     \
	| sed -e "s/\"/\n/g"     \
	| sed -e "s/ \{1,\}/ /g" \
	| sed -e "s/^ //"        \
	| sed -e "/^'/d"         \
	| sed -e "/^$/d"         \
	| sed -e "/…/d"          \
	| sed -e "/^ \{1,\}$/d"  \
	| sed -e "/^\-$/d"       \
	| tr '[:upper:]' '[:lower:]' \
	| sort
