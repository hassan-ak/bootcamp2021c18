import axios from 'axios'

export async function handler() {
    try {

        // creates a person vertex with an age property set to 25
        await axios.post('HTTPS://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher', 'query=CREATE (n:Person {first_name: "Hassan Ali", last_name: "Khan", age: 25 })')
        // retrieve the person created above and returning its age
        const fetch = await axios.post('HTTPS://' + process.env.NEPTUNE_ENDPOINT + ':8182/openCypher', 'query=MATCH (n:Person { last_name:"Khan" }) RETURN n')
        // Console Data
        console.log('RESPONSE', fetch.data)
        return {
            statusCode: 200,
            body: JSON.stringify(fetch.data.results),
          };
    }
    catch (e) {
        console.log('error', e)
        return {
            statusCode: 500,
            headers: { "Content-Type": "text/plain" },
            body: "error occured",
          };
    }
}